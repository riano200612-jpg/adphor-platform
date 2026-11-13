"""Two real PostgreSQL connections, synthetic rows, loopback CI database only."""
import concurrent.futures
import os
import subprocess
import threading
import uuid

assert os.environ.get('ADPHOR_ISOLATED_VISIT_TEST') == 'true'
assert os.environ.get('PGHOST') == '127.0.0.1'
assert os.environ.get('PGDATABASE') == 'adphor_visits_isolated'
ACTOR = '00000000-0000-0000-0000-000000000001'

def sql(query):
    return subprocess.run(['psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-c', query], capture_output=True, text=True, timeout=20)

def session(query):
    return f"begin; select set_config('test.uid','{ACTOR}',true),set_config('test.aal','aal2',true); set local role authenticated; {query}; commit;"

def race(identical):
    request = str(uuid.uuid4())
    created = sql(session(f"select request_id from qa_create_visit('p1','{request}','{ACTOR}','Synthetic concurrency','2026-11-14T10:00:00-05:00')"))
    assert created.returncode == 0, created.stderr
    first = str(uuid.uuid4())
    operation_ids = [first, first if identical else str(uuid.uuid4())]
    barrier = threading.Barrier(2)
    def attempt(operation):
        barrier.wait(timeout=5)
        # Hold the row lock after transition so the other connection must wait.
        return sql(session(f"select version from qa_transition_visit('p1','{request}','{operation}',1,'start','{{}}'); select pg_sleep(1)"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, operation_ids))
    assert sum(r.returncode == 0 for r in results) == (2 if identical else 1), [r.stderr for r in results]
    if not identical:
        assert any('40001' in r.stderr for r in results), [r.stderr for r in results]
    state = sql(f"select version||'|'||status||'|'||(select count(*) from qa_visit_history where request_id='{request}') from qa_visits where request_id='{request}'")
    assert state.returncode == 0 and state.stdout.strip() == '2|en_ejecucion|2', state.stdout+state.stderr
    print('PASS: concurrent '+('identical retry' if identical else 'version conflict')+'; version=2, events=2')

race(False)
race(True)

"""Exercise two independent sessions in a disposable local PostgreSQL cluster."""
import os
from pathlib import Path
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from tempfile import TemporaryDirectory
from threading import Barrier

ROOT = Path(__file__).resolve().parent
LOCAL_ENV = {key: value for key, value in os.environ.items() if not key.startswith("PG")}

def main():
    if not all(shutil.which(name) for name in ("initdb", "pg_ctl", "psql")):
        raise SystemExit("BLOCKED: add local initdb, pg_ctl and psql to PATH.")
    if os.geteuid() == 0:
        raise SystemExit("BLOCKED: PostgreSQL requires an unprivileged local user.")
    with TemporaryDirectory(prefix="adphor-pg-") as work:
        data = Path(work) / "data"
        subprocess.run(["initdb", "-D", data, "-A", "trust", "-U", "postgres"], check=True, stdout=subprocess.DEVNULL, env=LOCAL_ENV)
        subprocess.run(["pg_ctl", "-D", data, "-l", Path(work) / "postgres.log",
                        "-o", f"-c listen_addresses='' -k {work}", "-w", "start"], check=True, env=LOCAL_ENV)
        try:
            exercise(work)
        finally:
            subprocess.run(["pg_ctl", "-D", data, "-m", "fast", "-w", "stop"], check=True, env=LOCAL_ENV)

def exercise(socket):
    def sql(statement, check=True):
        return subprocess.run(["psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-h", socket,
                               "-U", "postgres", "-d", "postgres"], input=statement,
                              capture_output=True, text=True, check=check, env=LOCAL_ENV)

    sql("""
    create role authenticated;
    create schema auth;
    grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select current_setting('request.test_uid')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select jsonb_build_object('aal', current_setting('request.test_aal')) $$;
    create table memberships(project_id text,user_id uuid,role text,primary key(project_id,user_id));
    grant select on memberships to authenticated;
    insert into memberships values
      ('p1','00000000-0000-0000-0000-000000000001','admin'),
      ('p1','00000000-0000-0000-0000-000000000002','admin'),
      ('p2','00000000-0000-0000-0000-000000000003','admin');
    """ + (ROOT / "visit-persistence-prototype.sql").read_text())

    def save(key, motive, actor=1, project="p1", responsible=1, aal="aal2", hold=False):
        return sql(f"""
        begin;
        set local statement_timeout = '8s';
        set local role authenticated;
        set local request.test_uid = '00000000-0000-0000-0000-00000000000{actor}';
        set local request.test_aal = '{aal}';
        select row_to_json(v) from public.save_visit_draft(
          '{project}', '10000000-0000-0000-0000-00000000000{key}',
          '00000000-0000-0000-0000-00000000000{responsible}', '{motive}', '2026-11-13 10:00-05') v;
        {"do $$ begin perform pg_sleep(0.25); end $$;" if hold else ""}
        commit;
        """, check=False)

    def race(key, motives):
        barrier = Barrier(2, timeout=5)
        def run(motive):
            barrier.wait()
            return save(key, motive, hold=True)
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(run, motives))

    identical = race(1, ("Inspection", "Inspection"))
    assert all(result.returncode == 0 for result in identical), [r.stderr for r in identical]
    assert identical[0].stdout == identical[1].stdout
    contradictory = race(2, ("Inspection", "Maintenance"))
    assert sum(result.returncode == 0 for result in contradictory) == 1
    assert any("Conflicto de clave" in result.stderr for result in contradictory)

    # Drop the first response after a committed write and retry in another process.
    assert save(3, "Inspection").returncode == 0
    recovered = save(3, "Inspection")
    assert recovered.returncode == 0 and '"motive":"Inspection"' in recovered.stdout
    other = save(3, "Inspection", actor=2)
    assert "Conflicto de clave" in other.stderr and not other.stdout
    independent = save(3, "Separate", actor=3, project="p2", responsible=3)
    assert independent.returncode == 0 and '"motive":"Separate"' in independent.stdout
    assert "row-level security" in save(4, "Inspection", aal="aal1").stderr
    assert "foreign key" in save(4, "Inspection", responsible=3).stderr
    cross = sql("""
        set role authenticated;
        set request.test_uid = '00000000-0000-0000-0000-000000000003';
        set request.test_aal = 'aal2';
        select count(*) from visit_drafts where project_id = 'p1';
    """)
    assert cross.stdout.strip() == "0"
    assert sql("select count(*) from visit_drafts").stdout.strip() == "4"
    print("PASS: concurrent retries, conflicts, recovery and authorization")

if __name__ == "__main__":
    main()

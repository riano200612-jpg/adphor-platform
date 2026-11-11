-- QA rollback: retain records and authorized reads. Do not drop any data.
revoke execute on function public.qa_create_visit(text,uuid,uuid,text,timestamptz) from authenticated;
revoke insert on public.qa_visits from authenticated;

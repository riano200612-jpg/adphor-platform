import postgres from 'postgres';
import {calendarOAuthPages} from '../../../../../backend/src/calendar-oauth/pages-runtime.mjs';

export function onRequest(context) {
  return calendarOAuthPages(context,postgres);
}

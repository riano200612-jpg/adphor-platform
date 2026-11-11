import {test as base,expect} from '@playwright/test';
import {isolatedBrowserUrlAllowed} from './isolated-browser-policy.js';
export const test=base.extend({
 context:async({context},use)=>{
  const denied=[];
  await context.route('**/*',route=>{
   if(isolatedBrowserUrlAllowed(route.request().url()))return route.continue();
   denied.push(route.request().url());return route.abort('blockedbyclient');
  });
  await use(context);
  expect(denied,'Isolated fixture must not request external services').toEqual([]);
 }
});
export {expect};

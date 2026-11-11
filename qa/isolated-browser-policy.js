export function isolatedBrowserUrlAllowed(value){
 try{return new URL(value).origin==='http://127.0.0.1:8000';}catch{return false;}
}

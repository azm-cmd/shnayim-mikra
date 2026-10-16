/* Live-service settings. Fill these in once, following SETUP.md.
   While api is empty the site runs in demo mode: entries and winners stay on the visitor's device. */
(function(CSM){
'use strict';
CSM.SERVICE = {
  /* Web app URL from Apps Script, Deploy > Manage deployments. Ends in /exec */
  api: '',
  /* OAuth client ID for Sign in with Google. Ends in .apps.googleusercontent.com */
  googleClientId: ''
};
})(window.CSM = window.CSM || {});

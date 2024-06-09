export const environment = {
  production: false,
  hashLocationStrategy: false, // true would solve page refresh issues in GitHub pages,
  // but currently it interferes with SITNA map state management:
  // Map.js puts state changes in a hash fragment in the URL, but currently it
  // erases any other hash in that URL (a bug?)
  apiUrl: '/backend'
};

const axios = require('axios');
require('dotenv').config();

const config = token => ({
  headers: { Authorization: 'bearer ' + token },
});

module.exports = {
  getDeploys: (token, namespace) =>
    axios.get(
      `https://console.pathfinder.gov.bc.ca:8443/apis/apps.openshift.io/v1/namespaces/${namespace}/deploymentconfigs`,
      config(token),
    ),
};

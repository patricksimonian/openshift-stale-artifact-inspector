const axios = require('axios');
require('dotenv').config();

const config = {
  headers: {'Authorization': "bearer " + process.env.OC_TOKEN}
};

module.exports = {
  getDeploys: namespace => axios.get(`https://console.pathfinder.gov.bc.ca:8443/apis/apps.openshift.io/v1/namespaces/${namespace}/deploymentconfigs`, config)
}
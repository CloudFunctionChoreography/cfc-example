const fs = require('fs');


module.exports = (serverless) => {
    fs.createReadStream('./../ibm-openwhisk/workflows.json').pipe(fs.createWriteStream('./workflows.json'));


    return './workflows.json'

};
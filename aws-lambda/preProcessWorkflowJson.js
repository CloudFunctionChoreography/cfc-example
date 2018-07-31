const fs = require('fs');


module.exports = (serverless) => {
    fs.createReadStream('./../private-cloud/workflows.json').pipe(fs.createWriteStream('./workflows.json'));


    return './workflows.json'

};
'use strict';

// TODO: Open issue in OpenWhisk: https://github.com/apache/incubator-openwhisk-runtime-nodejs/issues/57
const dirname = __dirname;
const cfc = require(`cfc-lib`);


/**
 * Entry point to the action. It either executes the OpenWhisk action as a step in a defined workflow, or
 * as a usual action invocation.
 * @param params
 * @returns {*}
 */
function hello(params) {
    return new Promise((resolve, reject) => {
        const workflowsLocation = `${dirname}${params.workflowsLocation}`;
        const options = {
            functionExecitionId: process.env.__OW_ACTIVATION_ID,
            stateProperties: {test: "Test"},
            workflowsLocation: workflowsLocation,
            security: {
                openWhisk: {
                    owApiAuthKey: params.owApiAuthKey,
                    owApiAuthPassword: params.owApiAuthPassword
                },
                awsLambda: {
                    accessKeyId: params.awsAccessKeyId,
                    secretAccessKey: params.awsSecretAccessKey
                }
            }
        };

        if (params.workflowState || params.hintFlag) {
            cfc.executeWorkflowStep(params, options, handler).then(handlerResult => {
                resolve(handlerResult);
            }).catch(reason => {
                reject(reason);
            });
        } else {
            resolve(handler(params));
        }
    });
}

/**
 *
 * @param params
 * @returns Either an object or a promise that later resolves an object
 */
function handler(params) {
    let waitTill = new Date(new Date().getTime() + 500);
    while (waitTill > new Date()) {
    }
    return {success: `false`};

    /*Alternative:
    return new Promise((resolve, reject) => {
        console.log("hello from async handler");
        resolve({success: `false`});
    });*/
}

exports.hello = hello;

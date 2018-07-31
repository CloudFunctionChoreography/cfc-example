'use strict';

// TODO: Open issue in OpenWhisk: https://github.com/apache/incubator-openwhisk-runtime-nodejs/issues/57
const dirname = __dirname;
const fw = require(`serverless-function-choreography`);


/**
 * Entry point to the action. It either executes the OpenWhisk action as a step in a defined workflow, or
 * as a usual action invocation.
 * @param params
 * @returns {*}
 */
function hello(params) {
    return new Promise((resolve, reject) => {
        if (params.workflowState) {
            const workflowsLocation = `${dirname}${params.workflowsLocation}`;
            const stateProperties = {test: "Test"};

            fw.executeWorkflowStep(params, process.env.__OW_ACTIVATION_ID, stateProperties, workflowsLocation, handler).then(handlerResult => {
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
    return {success: `false`};

    /*Alternative:
    return new Promise((resolve, reject) => {
        console.log("hello from async handler");
        resolve({success: `false`});
    });*/
}

exports.hello = hello;

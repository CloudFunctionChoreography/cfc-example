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
        if (params.workflowState) {
            const workflowsLocation = `${dirname}${params.workflowsLocation}`;
            const stateProperties = {test: "Test"};
            cfc.executeWorkflowStep(params, process.env.__OW_ACTIVATION_ID, stateProperties, workflowsLocation, handler).then(handlerResult => {
                resolve(handlerResult);
            }).catch(reason => {
                reject(reason);
            });
        } else if (JSON.parse(params.__ow_body).workflowState) {
            const workflowsLocation = `${dirname}${params.workflowsLocation}`;
            const stateProperties = {test: "Test"};
            cfc.executeWorkflowStep(JSON.parse(params.__ow_body), process.env.__OW_ACTIVATION_ID, stateProperties, workflowsLocation, handler).then(handlerResult => {
                resolve(handlerResult);
            }).catch(reason => {
                reject(reason);
            });
        } else {
            console.log(JSON.stringify(params));
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
    return {success: `true`};

    /*Alternative:
    return new Promise((resolve, reject) => {
        console.log("hello from async handler");
        resolve({success: `false`});
    });*/
}

exports.hello = hello;

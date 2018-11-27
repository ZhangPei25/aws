'use strict';

const uuid = require('uuid/v1')
const aws = require('aws-sdk')

const dynamo = new aws.DynamoDB()

const errors = {
    missing_body: { code: 400, msg: 'Error: empty request' },
    json: { code: 400, msg: 'Error: JSON format' },
    missing_params: { code: 400, msg: 'Error: missing parameters' },
    wrong_param_format: { code: 400, msg: 'Error: invalid id' },
    wrong_param_format: { code: 400, msg: 'Error: parameters in wrong format' },
    db_error: { code: 500, msg: 'Error: database could not process request' },
    item_error: { code: 400, msg: 'Error: there is no this item in database' }
}
const error = (cb, errv) => {
    const err = errors[errv]
    cb(null, {
        statusCode: err.code || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: err.msg || 'Error'
    })
}
const ok = (cb, obj) => {
    cb(null, {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obj)
    })
}

module.exports.shopCreate = (event, context, cb) => {

    if (!event.body)
        return error(cb, 'missing_body')

    let data
    try { data = JSON.parse(event.body) } catch (e) { return error(cb, 'json') }

    if (!data.name)
        return error(cb, 'missing_params')

    if (typeof data.name !== 'string')
        return error(cb, 'wrong_param_format')

    const id = uuid()
    dynamo.putItem({
        TableName: 'shops',
        Item: {
            id: { S: id },
            name: { S: data.name },
        }
    }, (err, res) => {
        if (err)
            error(cb, 'db_error')
        else
            ok(cb, { id: id, name: data.name })
    })
};

module.exports.shopGetAll = (event, context, cb) => {

    dynamo.scan({
        TableName: 'shops',
    }, (err, data) => {
        if (err) {
            error(cb, 'db_error')
        } else {
            ok(cb, {
                count: data.Count,
                shops: data.Items.map(item => ({
                    id: item.id.S,
                    name: item.name.S
                }))
            })
        }
    })

};

module.exports.shopGet = (event, context, cb) => {
    if (!event.pathParameters || !event.pathParameters.id)
        return error(cb, 'missing_params')

    let id = event.pathParameters.id

    if (!id.match(/^[a-f0-9]{8,8}(\-[a-f0-9]{4,4}){3,3}\-[a-f0-9]{12,12}$/))
        return error(cb, 'wrong_id_format')

    dynamo.getItem({
        TableName: 'shops',
        Key: {
            "id": { S: id },
        }
    }, (err, res) => {
        if (err) {
            error(cb, 'db_error')
        } else {
            if (!res.Item) {
                error(cb, 'item_error')
            } else {
                ok(cb, { id: id, name: res.Item.name.S })
            }
        }
    })
};

module.exports.shopUpdate = (event, context, cb) => {

    if (!event.pathParameters || !event.pathParameters.id || !event.body)
        return error(cb, 'missing_body')

    let data
    try { data = JSON.parse(event.body) } catch (e) { return error(cb, 'json') }

    if (!data.name)
        return error(cb, 'missing_params')

    let id = event.pathParameters.id
    if (!id.match(/^[a-f0-9]{8,8}(\-[a-f0-9]{4,4}){3,3}\-[a-f0-9]{12,12}$/))
        return error(cb, 'wrong_id_format')

    dynamo.getItem({
        TableName: 'shops',
        Key: {
            "id": { S: id },
        }
    }, (err, res) => {
        if (err) {
            error(cb, 'db_error')
        } else {
            if (!res.Item) {
                error(cb, 'item_error')
            } else {
                dynamo.updateItem({
                    TableName: 'shops',
                    ExpressionAttributeNames: {
                        '#N': 'name'
                    },
                    ExpressionAttributeValues: {
                        ':nameValue': { S: data.name },
                    },
                    Key: {
                        "id": { S: id },
                    },
                    UpdateExpression: 'SET #N = :nameValue',
                    ReturnValues: 'ALL_NEW',
                }, (err, res) => {
                    if (err)
                        error(cb, 'db_error')
                    else {
                        ok(cb, { id: id, name: res.Attributes.name.S })
                    }
                })
            }
        }
    })
};
module.exports.shopDelete = (event, context, cb) => {
    if (!event.pathParameters || !event.pathParameters.id)
        return error(cb, 'missing_params')

    let id = event.pathParameters.id

    if (!id.match(/^[a-f0-9]{8,8}(\-[a-f0-9]{4,4}){3,3}\-[a-f0-9]{12,12}$/))
        return error(cb, 'wrong_id_format')

    dynamo.getItem({
        TableName: 'shops',
        Key: {
            "id": { S: id },
        }
    }, (err, res) => {
        if (err) {
            error(cb, 'db_error')
        } else {
            if (!res.Item) {
                error(cb, 'item_error')
            } else {
                dynamo.deleteItem({
                    TableName: 'shops',
                    Key: { id: { S: id } },
                    ReturnValues: "ALL_OLD"
                }, (err, res) => {
                    if (err) {
                        error(cb, 'db_error')
                    } else {
                        if (!res.Attributes.id) {
                            error(cb, 'item_error')
                        } else {
                            ok(cb, { msg: 'delete item successfully!' })
                        }
                    }
                })
            }
        }
    })
};
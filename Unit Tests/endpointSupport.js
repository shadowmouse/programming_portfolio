'use strict'

export const mockResponse = () => {
    let res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
}

export const mockAuthedRequest = (auth_token) => {
    return {
        headers : {
            authorization: `Bearer ${auth_token}`
        }
    }
}

export const mockApp = () => {
    let app = function () {};
    app.get = jest.fn()
    app.post = jest.fn()
    app.put = jest.fn()
    app.patch = jest.fn()
    app.delete = jest.fn()
    return app;
}


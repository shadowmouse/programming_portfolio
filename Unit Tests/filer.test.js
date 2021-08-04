import { units } from "../filer";
import fs from "fs"
import { promisify } from "util";
import path from "path"
import { mockResponse, mockAuthedRequest } from "./endpointSupport"

const Filer = units();

const test_path = "./order_files/8472";
const multi_file_path = "./order_files/8473"
afterAll(() => {

    fs.rmdir(test_path, { recursive: true }, (err) => {
        if (err) { console.log(err); return; }
    });
    fs.rmdir(multi_file_path, { recursive: true }, (err) => {
        if (err) { console.log(err); return; }
    })

})

test("Module Load", () => {
    expect(Filer).toBeDefined()
})

test("check order directory exists", () => {
    
    return Filer.checkOrderDir(test_path).then((results) => {
        expect(results).toStrictEqual(true);
        return true;
    }).then(() => {
        return new Promise((resolve, reject) => {
            fs.rmdir(test_path, { recursive: true },(err) => {
                if(err) { reject(err); return; }
                resolve();
            })
        })
        
    })
})

test("Add File Test", () => {

    let res = mockResponse();
    const dummyPath = "./src/server/__tests__/dummy_upload.txt";
    let dummyContent = "This is the very model of a modern major file storage";
    let setup = new Promise((resolve, reject) => {
        fs.writeFile(dummyPath, dummyContent, (err) => {
            if(err) { reject(err); return; }
            resolve(dummyPath);
        })
    })

    return setup.then(( path ) => {
        let req = {
            params: { 
                order_id: 8472
            },
            files: [{
                path: path,
                originalname: "dummy_upload.txt"
            }]
        }
        let next = jest.fn()
        return Filer.addFile(req, res, next).then((results) => { return { req: req, results: results } });
    }).then(({ results, req }) => {
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.send).toHaveBeenCalledWith(results)
        expect(results.status).toBe(true)
        expect(results.file).toBe(req.file)
        return true;
    })
    
})

test("Add Files Test", () => {

    let res = mockResponse();
    const dummyPath1 = "./src/server/__tests__/dummy_upload1.txt";
    const dummyPath2 = "./src/server/__tests__/dummy_upload2.txt";
    let dummyContent = "This is the very model of a modern major file storage";
    let writeFile = promisify(fs.writeFile)
    let setup = new Promise((resolve, reject) => {
        Promise.all([
            writeFile(dummyPath1, dummyContent),
            writeFile(dummyPath2, dummyContent),
        ]).then(() => {
            resolve([dummyPath1, dummyPath2])
        }).catch(err => {
            reject(err);
        })
    })

    return setup.then(( paths ) => {
        let req = {
            params: { 
                order_id: 8473
            },
            files : [
                {
                    path: paths[0],
                    originalname: "dummy_upload1.txt"
                },
                {
                    path: paths[1],
                    originalname: "dummy_upload2.txt"
                }
            ]
        }
        let next = jest.fn()
        return Filer.addFiles(req, res, next).then((results) => { return { req: req, results: results } });
    }).then(({ results }) => {
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.send).toHaveBeenCalledWith(results)
        expect(results.status).toBe(true)
        expect(results.files.length).toBe(2)
        expect(results.errors.length).toBe(0)
        return true;
    })
    
})

test("file exists - does exist", () => {

    let res = mockResponse();
    let req = {
        params: {
            order_id: 8472,
            filename: "dummy_upload.txt"
        }
    }
    let next = jest.fn()
    return Filer.checkExists(req, res, next).then((results) => {
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.send).toHaveBeenCalledWith(results)
        expect(results.status).toBe(true)
        expect(results.exists).toBe(true)
        return true;
    })
})

test("file exists - does not exist - good order", () => {

    let res = mockResponse();
    let req = {
        params: {
            order_id: 8472,
            filename: "dummy_upload_2.txt"
        }
    }
    let next = jest.fn()
    return Filer.checkExists(req, res, next).then((results) => {
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.send).toHaveBeenCalledWith(results)
        expect(results.status).toBe(true)
        expect(results.exists).toBe(false)
        return true;
    })
})

test("file exists - does not exist - bad order", () => {

    let res = mockResponse();
    let req = {
        params: {
            order_id: 11111111,
            filename: "dummy_upload_2.txt"
        }
    }
    let next = jest.fn()
    return Filer.checkExists(req, res, next).then((results) => {
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.send).toHaveBeenCalledWith(results)
        expect(results.status).toBe(true)
        expect(results.exists).toBe(false)
        return true;
    })
})

test("file download - does exist", () => {

    let res = mockResponse();
    res.download = jest.fn((path, name, callback) => {
        callback(null);
    });
    let req = {
        params: {
            order_id: 8472,
            filename: "dummy_upload.txt"
        }
    }
    let next = jest.fn()
    return Filer.getFile(req, res, next).then((results) => {
        expect(res.download).toBeCalledTimes(1)
        expect(res.download.mock.calls[0][0]).toBe(results.path);
        expect(res.download.mock.calls[0][1]).toBe(results.name);
        return true;
    })
})

test("file download - does not exist", () => {

    let res = mockResponse();
    res.download = jest.fn((path, name, callback) => {
        callback(null);
    });
    let req = {
        params: {
            order_id: 8472,
            filename: "dummy_upload_2.txt"
        }
    }
    let next = jest.fn()
    return Filer.getFile(req, res, next).catch((results) => {
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.send).toHaveBeenCalledWith(results)
        expect(results.status).toBe(false)
        expect(results.debug).toBeDefined();
        return true;
    })
})

test("file download zip - does exist", () => {

    let res = mockResponse();
    res.download = jest.fn((path, name, callback) => {
        callback(null);
    });
    let req = {
        params: {
            order_id: 8472
        }
    }
    let next = jest.fn()
    return Filer.getZip(req, res, next).then((results) => {
        expect(res.download).toBeCalledTimes(1)
        expect(res.download.mock.calls[0][0]).toBe(results.path);
        expect(res.download.mock.calls[0][1]).toBe(results.name);
        return true;
    })
})

test("list files - does exist", () => {

    let res = mockResponse();
    let req = {
        params: {
            order_id: 8472,
        }
    }
    let next = jest.fn()
    return Filer.listFiles(req, res, next).then((results) => {
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.send).toHaveBeenCalledWith(results)
        expect(results.status).toBe(true)
        expect(results.files.length).toBe(1)
        expect(results.files[0]["name"]).toBe("dummy_upload.txt")
    })
})

test("list files - does not exist", () => {

    let res = mockResponse();
    let req = {
        params: {
            order_id: 1111111,
        }
    }
    let next = jest.fn()
    return Filer.listFiles(req, res, next).then((results) => {
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.send).toHaveBeenCalledWith(results)
        expect(results.status).toBe(false)
        expect(results.files.length).toBe(0)
    })
})



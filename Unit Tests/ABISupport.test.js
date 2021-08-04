import { getAnalysis, getTrace, readDirEntry, getEntryData, readAB1Header, readAB1Directory } from "../ABISupport"
import fs from "fs"
import path from "path"

const sample_file_path = "./src/server/__tests__/sample.ab1.testfile"
const junk_file_path = "./src/server/__tests__/junk.ab1.testfile"

test("AB1 Header Read", () => {
    const filePath = path.resolve(sample_file_path);
    let openFile = new Promise((resolve, reject) => {
        fs.open(filePath, 'r', (err, fileData) => {
            if(err) {return reject(err);}
            resolve(fileData);
        })
    })

    return openFile.then((fd) => {
        return readAB1Header(fd)
    }).then((header) => {
        expect(header).toHaveProperty("format")
        expect(header).toHaveProperty("version")
        expect(header).toHaveProperty("directory")
        expect(header.format).toBe("ABIF")
        expect(header.version).toBeGreaterThan(0)
        expect(header.directory).toHaveProperty("name")
        expect(header.directory).toHaveProperty("number")
        expect(header.directory).toHaveProperty("element_type")
        expect(header.directory).toHaveProperty("element_size")
        expect(header.directory).toHaveProperty("element_count")
        expect(header.directory).toHaveProperty("element_byte_count")
        expect(header.directory).toHaveProperty("starting_offset")
        expect(header.directory).toHaveProperty("data_handle")
    })
    
})

test("AB1 Directory Read", () => {
    const filePath = path.resolve(sample_file_path);
    let openFile = new Promise((resolve, reject) => {
        fs.open(filePath, 'r', (err, fileData) => {
            if (err) { return reject(err); }
            resolve(fileData);
        })
    })

    function getRandomIntInclusive(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive 
    }

    return openFile.then((fd) => {
        return readAB1Header(fd).then((header) => { return { header: header, fileData: fd }; });
    }).then(({ header, fileData }) => {
        return readAB1Directory(header, fileData);
    }).then((directory) => {
        expect(directory.length).toBeGreaterThan(0)
        const randomIndex = getRandomIntInclusive(0, directory.length - 1);
        const randomEntry = directory[randomIndex];
        expect(randomEntry).toHaveProperty("name")
        expect(randomEntry).toHaveProperty("number")
        expect(randomEntry).toHaveProperty("element_type")
        expect(randomEntry).toHaveProperty("element_size")
        expect(randomEntry).toHaveProperty("element_count")
        expect(randomEntry).toHaveProperty("element_byte_count")
        expect(randomEntry).toHaveProperty("starting_offset")
        expect(randomEntry).toHaveProperty("data")
    })

})

test("Get Analysis Test - Valid File", () => {
    const file_path = path.resolve(sample_file_path)
    return getAnalysis(file_path).then((results) => {
        expect(results).toHaveProperty("length")
        expect(results).toHaveProperty("q20")
        expect(results).toHaveProperty("q40")
        expect(results).toHaveProperty("trimStart")
        expect(results).toHaveProperty("trimEnd")
        expect(results).toHaveProperty("trimLength")
        expect(results).toHaveProperty("lane")
        expect(results).toHaveProperty("aSignal")
        expect(results).toHaveProperty("cSignal")
        expect(results).toHaveProperty("gSignal")
        expect(results).toHaveProperty("tSignal")
        // Note: These checks are SPECIFIC to the provided sample AB1 file. DO NOT CHANGE THIS FILE AS IT IS TREATED AS THE BASELINE REFERENCE.
        expect(results.length).toBe(1179)
        expect(results.q20).toBe(986)
        expect(results.q40).toBe(648)
        expect(results.trimStart).toBe(36)
        expect(results.trimEnd).toBe(870)
        expect(results.trimLength).toBe(835)
        expect(results.lane).toBe(7)
        expect(results.aSignal).toBe(1213)
        expect(results.cSignal).toBe(1473)
        expect(results.gSignal).toBe(816)
        expect(results.tSignal).toBe(1310)
    })
})

test("Get Trace Test - Valid File", () => {
    const file_path = path.resolve(sample_file_path)
    return getTrace(file_path).then((results) => {
        expect(results).toHaveProperty("length")
        expect(results).toHaveProperty("q20")
        expect(results).toHaveProperty("q40")
        expect(results).toHaveProperty("trimStart")
        expect(results).toHaveProperty("trimEnd")
        expect(results).toHaveProperty("trimLength")
        expect(results).toHaveProperty("lane")
        expect(results).toHaveProperty("aSignal")
        expect(results).toHaveProperty("cSignal")
        expect(results).toHaveProperty("gSignal")
        expect(results).toHaveProperty("tSignal")
        expect(results).toHaveProperty("aTrace")
        expect(results).toHaveProperty("cTrace")
        expect(results).toHaveProperty("gTrace")
        expect(results).toHaveProperty("tTrace")
        // Note: These checks are SPECIFIC to the provided sample AB1 file. DO NOT CHANGE THIS FILE AS IT IS TREATED AS THE BASELINE REFERENCE.
        expect(results.length).toBe(1179)
        expect(results.q20).toBe(986)
        expect(results.q40).toBe(648)
        expect(results.trimStart).toBe(36)
        expect(results.trimEnd).toBe(870)
        expect(results.trimLength).toBe(835)
        expect(results.lane).toBe(7)
        expect(results.aSignal).toBe(1213)
        expect(results.cSignal).toBe(1473)
        expect(results.gSignal).toBe(816)
        expect(results.tSignal).toBe(1310)
        expect(results.aTrace.length).toBe(7328)
        expect(results.cTrace.length).toBe(7328)
        expect(results.gTrace.length).toBe(7328)
        expect(results.tTrace.length).toBe(7328)
    })
})

test("Get Analysis Test - Invalid File", () => {
    const file_path = path.resolve(junk_file_path)
    return getAnalysis(file_path).catch((err) => {
        expect(err).toContain("Loaded File is not ABIF")
    });
})

test("Get Analysis Test - Invalid Path", () => {
    const file_path = path.resolve("./dne.ab1")
    return getAnalysis(file_path).catch((err) => {
        expect(err.message).toContain("ENOENT")
    });
})





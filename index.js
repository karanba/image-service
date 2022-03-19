import express from 'express';
import sharp from 'sharp';
import multer from 'multer';
import path from 'path';
import {
    createWriteStream
} from 'node:fs';
import {
    pipeline
} from 'node:stream';
import {
    promisify
} from 'node:util'
import fs from 'fs';
import fetch from 'node-fetch';

const streamPipeline = promisify(pipeline);
const __dirname = path.resolve();
const app = express();
const upload = multer({
    storage: multer.memoryStorage()
});

async function download(url, fileName) {
    console.log(`dowloading from ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);
    fs.mkdirSync(fileName.substr(0, fileName.lastIndexOf('/')), {
        recursive: true
    });
    await streamPipeline(response.body, createWriteStream(fileName));
}

app.set('view engine', 'ejs');
const options = {
    root: path.join(__dirname)
};

app.get('/i/*', async (req, res) => {
    const requestedFile = req.params[0];
    console.log(`requestedFile: ${requestedFile}`);

    const extension = path.extname(requestedFile);
    const responseFilePath = requestedFile.replace(extension, '.webp');

    if (fs.existsSync(responseFilePath)) {
        console.log(`existing one sending ${responseFilePath}`);
        res.sendFile(responseFilePath, options);
        return;
    }

    
    await download(`https://api.binbirdogal.com/Uploads/${requestedFile}`, requestedFile);
    await convert(requestedFile, responseFilePath);

    res.sendFile(responseFilePath, options);
});

app.listen(4000, () => {
    console.log('listening on port 4000');
});

async function convert(fileName, outputFileName) {
    console.log(`converting ${fileName} to ${outputFileName}`);
    return await sharp(fileName)
        .toFile(outputFileName);
}
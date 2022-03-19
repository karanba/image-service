import config from 'config';
import express from 'express';
import sharp from 'sharp';
import multer from 'multer';
import path from 'path';
import mime from 'mime';
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

const ImageServerConfig = config.get('ImageServer');
const AppConfig = config.get('App');

async function download(url, fileName) {
    console.log(`dowloading from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        return response;
    }
    const storeFolder = path.join(__dirname, fileName.substr(0, fileName.lastIndexOf('/')));
    const file = path.join(__dirname, fileName);
    fs.mkdirSync(storeFolder, {
        recursive: true
    });
    await streamPipeline(response.body, createWriteStream(file));
}


function getSendFileOptions(req, responseFilePath) {
    return {
        root: path.join(__dirname),
        dotfiles: 'deny',
        headers: {
            'x-timestamp': Date.now(),
            'x-sent': true,
            'Cache-Control': AppConfig.Response.Headers['Cache-Control'],
            'Content-Type': req.query.hasOwnProperty('webp') ?
                'image/webp': mime.getType(responseFilePath)
        }
    };
}
app.set('view engine', 'ejs');

app.get('/i/*', async (req, res) => {
    

    const requestedFile = req.params[0];
    console.log(`requestedFile: ${requestedFile}`);

    const extension = path.extname(requestedFile);

    const responseFilePath = req.query.hasOwnProperty('webp') ?
        requestedFile.replace(extension, '.webp') :
        requestedFile;

    if (fs.existsSync(path.join(__dirname, responseFilePath)) && fs.statSync(path.join(__dirname, responseFilePath)).isFile()) {
        console.log(`existing one sending ${responseFilePath}`);
        res.sendFile(responseFilePath, getSendFileOptions(req, responseFilePath));
        return;
    }


    const downloadResponse = await download(`${ImageServerConfig.Address.scheme}://${ImageServerConfig.Address.host}:${ImageServerConfig.Address.port}${requestedFile}`, requestedFile);
    if (downloadResponse && !downloadResponse.ok) {
        res.status(downloadResponse.status).send(downloadResponse.statusText);
        return;
    }
    if (req.query.hasOwnProperty('webp')) {
        await convert(requestedFile, getSendFileOptions(req, responseFilePath));
    }

    res.sendFile(responseFilePath, options);
});

app.listen(AppConfig.Port, () => {
    console.log(`${AppConfig.Name} started`);
    console.log(`listening on port ${AppConfig.Port}`);
});

async function convert(fileName, outputFileName) {
    console.log(`converting ${fileName} to ${outputFileName}`);
    return await sharp(path.join(__dirname, fileName))
        .toFile(path.join(__dirname, outputFileName));
}
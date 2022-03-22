import dotenv from 'dotenv';
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

const result = dotenv.config({
    path: path.join(path.resolve(), '.env')
});

if (result.error) {
    throw result.error
}

const streamPipeline = promisify(pipeline);
const __dirname = path.resolve();
const app = express();

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
            'x-env': config.util.getEnv('NODE_ENV'),
            'Cache-Control': AppConfig.Response.Headers['Cache-Control'],
            'Content-Type': req.query.hasOwnProperty('webp') ?
                'image/webp' : mime.getType(responseFilePath)
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


    const downloadResponse = await download(`${ImageServerConfig.Address.scheme}://${ImageServerConfig.Address.host}:${ImageServerConfig.Address.port}/${requestedFile}`, requestedFile);
    if (downloadResponse && !downloadResponse.ok) {
        res.status(downloadResponse.status).send(downloadResponse.statusText);
        return;
    }
    if (req.query.hasOwnProperty('webp')) {
        await convert(requestedFile, responseFilePath);
    }

    res.sendFile(responseFilePath, getSendFileOptions(req, responseFilePath));
});

const PORT = process.env.PORT || AppConfig.Port;
app.listen(PORT, () => {
    console.log("\x1b[44m", `${AppConfig.Name} started`, "\x1b[0m");
    console.log('NODE_ENV: ' + config.util.getEnv('NODE_ENV'));
    console.log('NODE_CONFIG_ENV: ' + config.util.getEnv('NODE_CONFIG_ENV'));
    console.log(`NODE_CONFIG_DIR: ${process.env.NODE_CONFIG_DIR}`);
    console.log(`Image Source: ${ImageServerConfig.Address.scheme}://${ImageServerConfig.Address.host}:${ImageServerConfig.Address.port}`);
    console.log(`listening on port ${PORT}`);
    console.log(`Your server available at http://localhost:${PORT}`);
    console.log("\x1b[44m", "----------------------------", "\x1b[0m");
});

async function convert(fileName, outputFileName) {
    console.log(`converting ${fileName} to ${outputFileName}`);
    return await sharp(path.join(__dirname, fileName))
        .webp(AppConfig.Options.webp)
        .toFile(path.join(__dirname, outputFileName));
}
import dotenv from 'dotenv';
import winston from 'winston';
import 'winston-daily-rotate-file';
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


const logConfiguration = {
    transports: [
        new winston.transports.DailyRotateFile({
            filename: './logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD-HH',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error'
        }),
        new winston.transports.DailyRotateFile({
            filename: './logs/application-%DATE%.log',
            datePattern: 'YYYY-MM-DD-HH',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
        })
    ],
    format: winston.format.combine(
        winston.format.label({
            label: `Label🏷️`
        }),
        winston.format.timestamp({
            format: 'MMM-DD-YYYY HH:mm:ss'
        }),
        winston.format.printf(info => `${info.level}: ${info.label}: ${[info.timestamp]}: ${info.message}`),
    )
};

const logger = winston.createLogger(logConfiguration);

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console());
}



async function download(url, fileName) {
    logger.info(`dowloading from ${url}`);
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
    logger.info(`requestedFile: ${requestedFile}`);

    const extension = path.extname(requestedFile);

    const responseFilePath = req.query.hasOwnProperty('webp') ?
        requestedFile.replace(extension, '.webp') :
        requestedFile;

    if (fs.existsSync(path.join(__dirname, responseFilePath)) && fs.statSync(path.join(__dirname, responseFilePath)).isFile()) {
        logger.info(`existing one sending ${responseFilePath}`);
        res.sendFile(responseFilePath, getSendFileOptions(req, responseFilePath));
        return;
    }


    const downloadResponse = await download(`${ImageServerConfig.Address.scheme}://${ImageServerConfig.Address.host}:${ImageServerConfig.Address.port}/${requestedFile}`, requestedFile);
    if (downloadResponse && !downloadResponse.ok) {
        logger.error(`download failed ${downloadResponse.status} ${downloadResponse.statusText}`);
        res.status(downloadResponse.status).send(downloadResponse.statusText);
        return;
    }
    if (req.query.hasOwnProperty('webp')) {
        await convert(requestedFile, responseFilePath);
    }

    res.sendFile(responseFilePath, getSendFileOptions(req, responseFilePath));
});

app.use((err, req, res, next) => {
    logger.error(err.stack)
    res.status(500).send('Something broke!')
})

const PORT = process.env.PORT || AppConfig.Port;
app.listen(PORT, () => {
    logger.info(`${AppConfig.Name} started`);
    logger.info('NODE_ENV: ' + config.util.getEnv('NODE_ENV'));
    logger.info('NODE_CONFIG_ENV: ' + config.util.getEnv('NODE_CONFIG_ENV'));
    logger.info(`NODE_CONFIG_DIR: ${process.env.NODE_CONFIG_DIR}`);
    logger.info(`Image Source: ${ImageServerConfig.Address.scheme}://${ImageServerConfig.Address.host}:${ImageServerConfig.Address.port}`);
    logger.info(`listening on port ${PORT}`);
    logger.info(`Your server available at http://localhost:${PORT}`);
    logger.info("----------------------------");
});

async function convert(fileName, outputFileName) {
    logger.info(`converting ${fileName} to ${outputFileName}`);
    return await sharp(path.join(__dirname, fileName))
        .webp(AppConfig.Options.webp)
        .toFile(path.join(__dirname, outputFileName));
}
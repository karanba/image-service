import dotenv from 'dotenv';
import config from 'config';
import nodeWindows from 'node-windows';
import path from 'path';
const __dirname = path.resolve();
const AppConfig = config.get('App');

const svc = new nodeWindows.Service(
    {
        name: AppConfig.ServieName,
        description: AppConfig.Description,
        script: path.join(__dirname, AppConfig.ServiceFileName)
    }
);

svc.on('install', () => { 
    svc.start();
});

svc.install();
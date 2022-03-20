import nodeWindows from 'node-windows';
import path from 'path';
const __dirname = path.resolve();
const svc = new nodeWindows.Service(
    {
        name: 'MySvc',
        description: 'MySvc is a simple Node.js service.',
        script: path.join(__dirname, 'service.js')
    }
);

svc.on('install', () => { 
    svc.start();
});

svc.install();
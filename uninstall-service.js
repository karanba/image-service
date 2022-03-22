import config from 'config';
import nodeWindows from 'node-windows';
import path from 'path';
const __dirname = path.resolve();
const AppConfig = config.get('App');

// Create a new service object
var svc = new nodeWindows.Service({
    name: AppConfig.ServieName,
    script: path.join(__dirname, AppConfig.ServiceFileName)
});

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall', function () {
    console.log('Uninstall complete.');
    console.log('The service exists: ', svc.exists);
});

// Uninstall the service.
svc.uninstall();
const fs = require('fs');
const path = require('path');
const {app, dialog} = require('electron');

const migrate = (mainWindow, config) => {
	const targetDir = path.join(app.getPath('appData'), 'LibreRambox');
	const sourceDir = path.join(app.getPath('appData'), 'Rambox');

	const modifyConfig = () => {
		const configPath = path.join(targetDir, "config.json");

		try {
			const data = fs.readFileSync(configPath, 'utf8');
			const configObject = JSON.parse(data);
			configObject.migrated = true;
			const updatedConfigData = JSON.stringify(configObject, null, 2);

			fs.writeFileSync(configPath, updatedConfigData, 'utf8');
		} catch (err) {
			console.error("Could not find config: ");
			console.error(err);
		}
	}

	const copyFiles = (source, target) => {
		const files = fs.readdirSync(source);

		files.forEach((file) => {
			const sourceFile = path.join(source, file);
			const targetFile = path.join(target, file);

			try {
				const stats = fs.statSync(sourceFile);

				if (stats.isDirectory()) {
					if (!fs.existsSync(targetFile)) {
						fs.mkdirSync(targetFile);
					}
					copyFiles(sourceFile, targetFile);
				} else {
					try {
						fs.copyFileSync(sourceFile, targetFile);
					} catch (err) {
						console.error(`Could not copy ${sourceFile} to ${targetFile}:`);
						console.error(err);
					}
				}
			} catch {
				// do nothing
			}
		});
	}

	if (config.get('migrated') === true || !fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) {
		return;
	}

	buttonIndex = dialog.showMessageBoxSync(mainWindow, {
		type: 'question',
		title: 'Migration Assistant',
		message: 'Do you want to migrate from the Rambox configuration?',
		detail: 'This operation will override the current configuration.\nThe app will freeze for a moment.',
		buttons: ['Yes', 'No'],
		defaultId: 0,
		cancelId: 1,
	});

	if (buttonIndex === 0) {
		copyFiles(sourceDir, targetDir);
		modifyConfig();

		app.relaunch();
		app.exit(0);
	}
}

module.exports = {migrate};

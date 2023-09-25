const fs = require('fs');
const data = require('./resources/services.json');
const file = 'services.md';
const logoPath = 'resources/icons';

fs.writeFileSync(file, '# Apps available\n\n');
fs.appendFileSync(file, 'We currently support the following apps out of the box: \n');


data.forEach(service => {
		const { logo, name, url } = service;

		fs.appendFileSync(file, `* <img src="${logoPath}/${logo}" alt="${name}" height="25" /> <a href="${url}">${name}</a>\n`);
});

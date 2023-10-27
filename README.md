<div align="center">
  <h1>
    <br />
    <a href="https://github.com/LibreRambox/LibreRambox"><img src="./resources/Icon.png" width="256px" alt="LibreRambox" /></a><br />
    LibreRambox
    <br /><br/>
  </h1>
	LibreRambox is a Fork from Rambox Community Edition v0.8. No Rambox-Account requirement, no subscription plans. 

  <h4>Unleash Seamless Communication: The Ultimate Open-Source Messaging & Emailing Fusion.</h4>

  <p>
    <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank"><img src="https://img.shields.io/github/license/librerambox/librerambox.svg" alt="GNU GPL v3" /></a>
    <a title="Crowdin" target="_blank" href="https://crowdin.com/project/librerambox"><img src="https://badges.crowdin.net/librerambox/localized.svg"></a>
  </p>
	<p>
		<a target="_blank" href="https://github.com/LibreRambox/LibreRambox/releases"> <img alt="Release" src="https://img.shields.io/github/v/release/LibreRambox/LibreRambox"></a>
	</p>
  <p>
    <img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/LibreRambox/LibreRambox/build.yml">
  </p>

  <h5>Releases for Windows, Mac and Linux.</h5>

  <a href="https://github.com/LibreRambox/LibreRambox/releases" target="_blank"><img src="https://cdn.rawgit.com/saenzramiro/rambox/gh-pages/images/img-download.svg" width="250" alt="DOWNLOAD NOW" /></a>

  <h5>Nightly Builds for Windows, Mac and Linux</h5>

  <a href="https://github.com/LibreRambox/LibreRambox/actions/workflows/build.yml" target="_blank"><img src="https://cdn.rawgit.com/saenzramiro/rambox/gh-pages/images/img-download.svg" width="150" alt="DOWNLOAD NOW" /></a>


  <h6>Logo designed by <a href="https://www.linkedin.com/in/andriyyurchenko/" target="_blank">Andriy Yurchenko</a></h6>
</div>

---

## Table of Contents

- [Screenshot](#screenshot)
- [Apps available](#apps-available)
- [Features](#features)
- [Privacy](#privacy)
- [Translations](#translations)
- [Install on Linux - Steps](#install-on-linux---steps)
- [Contributing](#contributing)
  - [Quickstart](#quickstart)
- [Disclosure](#disclosure)
- [Licence](#licence)

---

## Screenshot

![LibreRambox](./resources/screenshots/mac.png)

## Apps available

A full list is available [here](services.md).

## Features

- [x] Multi-language.
- [x] Sync your configuration between multiple computers.
- [x] Master Password.
- [x] Lock LibreRambox if you will be away for a period of time.
- [x] Don't disturb mode.
- [x] Reorder applications in the tab bar.
- [x] Notification badge in the tab.
- [x] Minimize to tray.
- [x] Mute audio to specific service.
- [x] Separate tabs floating to the right.
- [x] Disable a service instead of remove it.
- [x] Start automatically on system startup.
- [x] Custom Code Injection.
- [x] Keyboard Shortcuts.
- [x] Proxy.
- [x] Switch from horizontal to vertical tab bar.

## Privacy

No personal information will be saved

Sessions will persist using the [partition:persist](https://electronjs.org/docs/api/webview-tag#partition) attribute for Webviews.
So every time you open LibreRambox, your sessions will keep alive until you remove the service.

Sync feature use Auth0 for Single Sign On & Token Based Authentication and to store the services that user is using (and the configuration for each service).
You are always welcome to check the code! ;)

## Translations

Help us translate LibreRambox on [https://crowdin.com/project/librerambox/invite](https://crowdin.com/project/librerambox).

## [Install on Linux - Steps](https://github.com/ramboxapp/LibreRambox/wiki/Install-on-Linux)

## [Contributing](./CONTRIBUTING.md)

Want to report a bug, request a feature, contribute to or translate LibreRambox?
We need all the help we can get!
Fork and work!

### Quickstart

```shell
git clone https://github.com/LibreRambox/LibreRambox.git
cd LibreRambox
npm install
sencha app watch
npm start
```

See [Contributing.md](./CONTRIBUTING.md) for more detailed information about getting set up.

---

## Disclosure

LibreRambox is not affiliated with any of the messaging apps offered.

## Licence

[GNU GPL v3](https://github.com/LibreRambox/LibreRambox/blob/master/LICENSE)

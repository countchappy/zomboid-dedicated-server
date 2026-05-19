# Project Zomboid Dedicated Server

## Disclaimer

**Note:** This image is not officially supported by Valve, nor by The Indie Stone.

If issues are encountered, please report them on
the [GitHub repository](https://github.com/Renegade-Master/zomboid-dedicated-server/issues/new/choose)

## Badges

[![Build and Test Server Image](https://github.com/Renegade-Master/zomboid-dedicated-server/actions/workflows/docker-build.yml/badge.svg?branch=main)](https://github.com/Renegade-Master/zomboid-dedicated-server/actions/workflows/docker-build.yml)
[![Docker Repository on Quay](https://quay.io/repository/renegade_master/zomboid-dedicated-server/status "Docker Repository on Quay")](https://quay.io/repository/renegade_master/zomboid-dedicated-server)

![Docker Image Version (latest by date)](https://img.shields.io/docker/v/renegademaster/zomboid-dedicated-server?label=Latest%20Version)
![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/renegademaster/zomboid-dedicated-server?label=Image%20Size)
![DockerHub Pulls](https://img.shields.io/docker/pulls/renegademaster/zomboid-dedicated-server?label=DockerHub%20Pull%20Count)

## Description

Dedicated Server for Project Zomboid using Docker, and optionally Docker-Compose.
Built almost from scratch to be the smallest Project Zomboid Dedicated Server around!
The image also includes a web portal for public server status, authenticated management, logs, RCON-backed metrics,
start/stop/restart control, local user management, and an operator command terminal.

**Note:** This Image is "rootless", and therefore should not be run as the `root` user.
Attempting to do so will prevent the server from starting (
see [#8](https://github.com/Renegade-Master/zomboid-dedicated-server/issues/8)
, [#14](https://github.com/Renegade-Master/zomboid-dedicated-server/issues/14)).

Bare-Minimum instructions to get a server running:

```shell
# Pull the latest image:
docker pull renegademaster/zomboid-dedicated-server:latest

# Make two folders
mkdir ZomboidConfig ZomboidDedicatedServer

# Run the server (with bare minimum options):
docker run --detach \
    --mount type=bind,source="$(pwd)/ZomboidDedicatedServer",target=/home/steam/ZomboidDedicatedServer \
    --mount type=bind,source="$(pwd)/ZomboidConfig",target=/home/steam/Zomboid \
    --publish 16261:16261/udp --publish 16262:16262/udp --publish 8080:8080/tcp \
    --env=PORTAL_ADMIN_PASSWORD=changeme_portal \
    --env=PORTAL_SESSION_SECRET=change_this_portal_session_secret \
    --name zomboid-server \
    docker.io/renegademaster/zomboid-dedicated-server:latest
```

The default behaviour of the Container is not to automatically restart after a crash to give the user time to investigate the cause of the issue. You may however want to change the [restart policy](https://docs.docker.com/engine/reference/run/#restart-policies---restart) to automatically recover from an unexpected failure. The following options will help to recover from such a situation:

- `--restart=unless-stopped` will restart the container every time that it exits unless the Container is stopped using the Docker/Podman API.
- `--restart=on-failure[:max-retries]` will restart the container only if it exits with a non-zero exit code. Optionally, it can also be configured to only restart a fixed number of times to help prevent crash-loops.

These same options can be set in the `docker-compose.yaml` file.

### Assurance / Testing

For every commit, the server is built and started briefly using GitHub Actions. This is to ensure that the server always
works, and makes it less likely that there will be a version released that does not function. The main configurations
are changed and checked after starting the server to verify that it is possible for a user to configure their instance.
Custom Ports and Remote RCON commands are also used during the validation to ensure that the user can host the server
using any Port combination of their choice. You can view the previous Action
runs [here](https://github.com/Renegade-Master/zomboid-dedicated-server/actions/workflows/docker-build.yml).

## Links

### Source:

- [GitHub Repository](https://github.com/Renegade-Master/zomboid-dedicated-server)

### Images:

| Provider                                                                                                               | Image                                               | Pull Command                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [GitHub Packages](https://github.com/Renegade-Master/zomboid-dedicated-server/pkgs/container/zomboid-dedicated-server) | `ghcr.io/renegade-master/zomboid-dedicated-server`  | `docker pull ghcr.io/renegade-master/zomboid-dedicated-server:x.y.z`<br/>`docker pull ghcr.io/renegade-master/zomboid-dedicated-server:latest`   |
| [DockerHub](https://hub.docker.com/r/renegademaster/zomboid-dedicated-server)                                          | `docker.io/renegademaster/zomboid-dedicated-server` | `docker pull docker.io/renegademaster/zomboid-dedicated-server:x.y.z`<br/>`docker pull docker.io/renegademaster/zomboid-dedicated-server:latest` |
| [Red Hat Quay](https://quay.io/repository/renegade_master/zomboid-dedicated-server)                                    | `quay.io/renegade_master/zomboid-dedicated-server`  | `docker pull quay.io/renegade_master/zomboid-dedicated-server:x.y.z`<br/>`docker pull quay.io/renegade_master/zomboid-dedicated-server:latest`   |

### External Resources:

- [Dedicated Server Wiki](https://pzwiki.net/wiki/Dedicated_Server)
- [Dedicated Server Configuration](https://pzwiki.net/wiki/Server_Settings)
- [Steam DB Page](https://steamdb.info/app/380870/)

## Prerequisites

### Directories

Two directories are required to be present on the host:

| Name               | Directory                | Description                                          |
| ------------------ | ------------------------ | ---------------------------------------------------- |
| Configuration Data | `ZomboidConfig`          | For storing the server configuration and save files. |
| Installation Data  | `ZomboidDedicatedServer` | For storing the server game data.                    |

These folders must be created in the directory that you intend to run the Docker image from. This could be a folder that
you have created in some kind of "server directory", or it could be the root of this repository after you have cloned it
down. **_If these folders are not present when the Docker image starts, you will get permissions errors_** (
see [#8](https://github.com/Renegade-Master/zomboid-dedicated-server/issues/8)
, [#14](https://github.com/Renegade-Master/zomboid-dedicated-server/issues/14)
, [#17](https://github.com/Renegade-Master/zomboid-dedicated-server/issues/17)) because the Docker engine will create
the folders at Container runtime. This creates them under the `root` user on the host which causes permissions
conflicts.

The 'Configuration Data' folder is where the server configuration and save files are stored. This folder can be opened
and edited just like if you were running the server without Docker. You can backup your save files, or edit the server
configuration files. You should start the server once successfully before attempting to edit files in the 'Configuration
Data' folder. Once the files are generated, it is safe to edit them. Most configuration option changes will require a
restart of the server to properly take effect. Most of these settings are also configurable from the in-game Admin menu.

The 'Installation Data' folder is where the server game data is stored. This folder can be opened and edited, but a full
restart of the server can sometimes reset changes to this folder during file verification. Therefore, the recommended
way to change files that would be stored in this folder is to use the Environment Variables in the 'Optional Arguments'
table provided by the Docker image.

### Ports

There are a total of four ports that can be utilised by the server and portal, but only the two game ports are strictly
required:

| Name           | Default Port | Description                                                          | Required |
|----------------|--------------|----------------------------------------------------------------------| -------- |
| `DEFAULT_PORT` | `16261`      | Port used by the server to listen for connections.                   | yes      |
| `RCON_PORT`    | `27015`      | Port used by the server to listen for RCON connections/commands.     | no       |
| `UDP_PORT`     | `16262`      | Additional Port used by the server to facilitate Client connections. | yes      |
| `PORTAL_PORT`  | `8080`       | TCP port used by the authenticated web portal.                       | no       |

All Ports are configurable to use different Port numbers, however you must be aware that by changing a Port in the game
configuration files, that you must also expose the changed (or default) Port in the Docker run command `--publish ...`
or present under the `services.zomboid-server.ports` configuration key of the Docker-Compose file. Also, _**it is
essential that these Ports are not blocked by a firewall**_. If you are behind a router and/or firewall, you will almost
definitely need to open these Ports in order for anyone else outside your network to connect to the server. Port
forwarding, and opening Ports in hosted servers is not within the scope of this project. To get instructions for your
specific use case you will need to ask your ISP, Server Provider, or consult the instructions on your Third-Party
Router.

The strictly required Ports (`DEFAULT_PORT` and `UDP_PORT`) are used by the server to listen for connections and
communicate with connected clients. These Ports must be assigned a value, and must be accessible from the Internet
(i.e. "forwarded").

If you intend to use RCON clients outside the container, then `RCON_PORT` must also be published and reachable. This is
not required if you do not intend to connect to RCON directly. The portal can use configured RCON internally for safe
player warnings, RCON status metrics, and terminal RCON commands. Set `RCON_PORT=0` or omit `RCON_PASSWORD` to disable
those RCON-backed portal features; non-RCON portal terminal commands remain available to operators.

### Web portal

The container starts an Express web portal on `PORTAL_PORT` and the portal supervises the Project Zomboid process. By
default, the portal starts the game server automatically after install/update/configuration completes. If the game server
stops or crashes, the portal stays available so an authenticated user can inspect the log tail and start it again.
Unauthenticated visitors open `/` and see a read-only public status page first. The public page is designed for players
and only shows whitelisted server identity, high-level state, readiness, and the sign-in entry point. After sign-in, the
authenticated management dashboard loads at `/manage` so returning to `/` starts with a fresh sign-in form and public
landing page state.

Local authentication is used when no external IdP is configured. Set `PORTAL_ADMIN_PASSWORD` on the first run to create
the SQLite-backed bootstrap user. This user is always a protected `operator`. The user database is stored under the
`ZomboidConfig` volume by default at `/home/steam/Zomboid/portal/portal.sqlite`, and existing databases are migrated in
place on startup.

The portal can also use an external IdP. With `PORTAL_AUTH_PROVIDER=auto`, a complete OIDC configuration is preferred,
then a complete OAuth2 configuration, otherwise local auth is used. Partial external configuration fails fast. External
users must match at least one configured allow list. Role mapping happens after the allow list passes.

Portal roles:

| Role        | Access                                                                 |
|-------------|------------------------------------------------------------------------|
| `read_only` | Authenticated status, logs, and recent activity.                       |
| `admin`     | Read-only access plus RCON status metrics, start/stop/restart, and safe actions. |
| `operator`  | Admin access plus local user management and the command terminal.      |

For local auth, operators can create users at any role. The generated initial password is shown once, and the new user
must change it on first login. The bootstrap operator cannot be changed or deleted from the portal.

The management dashboard includes:

- A log tail and recent action audit.
- Cached read-only RCON server status metrics for admins and operators.
- Guided start, safe stop, safe restart, immediate stop, and immediate restart actions for admins and operators.
- Local user management for operators.
- A command terminal for operators.

Public status shows only safe aggregate data from the RCON status cache when available: players online, zombies, and
zombies killed today. It does not expose logs, usernames, action history, process details, RCON settings, auth settings,
filesystem paths, secrets, or raw internal errors.

When `RCON_PORT` is present/nonzero and `RCON_PASSWORD` is set, the portal enables RCON-backed metrics, terminal RCON
commands, and safe stop/restart controls. Safe actions broadcast player warnings over RCON at every remaining minute
above 1 minute, then at 60, 30, 15, and every second from 10 through 1 when those seconds are inside the countdown. Safe
actions run `save` before stopping or restarting. Immediate stop/restart controls remain available behind an expanded
section and require confirmation.

The default safe-action countdown is 5 minutes. In the guided UI, safe stop and safe restart expose a slider from
1 minute to 15 minutes. In the command terminal, use `-t` or `--countdown-seconds` with values from `60` to `900`.

#### Command terminal

Operators can use the command terminal from the management dashboard's `Command terminal` tab. On desktop viewports, a
fixed launcher in the lower-right corner opens the same terminal in a bottom drawer; the launcher is hidden on
smaller/mobile viewports. The tab and drawer share one frontend state, so submitted commands, output, history recall,
clears, and completion updates stay in sync.

Terminal history is persisted per authenticated user in the portal SQLite database. The latest 100 non-empty
submissions are retained, including duplicates, failures, output, status, exit code, signal, and timestamp. Persisted
entries are restored for display and command recall only; actions are never replayed after login.

The terminal API is operator-only: `GET /api/terminal/history?limit=100` loads persisted entries and
`POST /api/terminal/commands` submits commands. The legacy `POST /api/rcon/commands` route remains for compatibility,
but the web UI uses the terminal endpoint.

Terminal input behavior:

- Press `Enter` to submit the current command.
- Press `ArrowUp` and `ArrowDown` to recall older/newer submitted inputs. Moving past the newest entry restores the
  draft you were typing.
- Press <kbd>Ctrl</kbd>+<kbd>`</kbd> on Windows/Linux or <kbd>Meta</kbd>+<kbd>`</kbd> on macOS to open the desktop
  terminal drawer. Press the shortcut again while the drawer is open to close it. When the `Command terminal` tab is
  already active, the shortcut focuses the tab input instead.
- Press `Escape`, click the overlay, or click the close button to close the drawer.
- While a command is running, the input is cleared, the command is echoed into the terminal, and the entry input is
  locked until the command completes.

RCON commands must start with `/` or `\`; the portal strips that prefix before sending the command to RCON:

```text
/servermsg "Hello survivors"
\servermsg "Hello survivors"
```

Portal commands start with `!`:

| Command | Description |
|---------|-------------|
| `!help` | Print terminal command help. |
| `!history clear` | Clear the current user's persisted terminal history. |
| `!start` | Start the server. Add `-c` or `--check-updates` to force an update check before launch. |
| `!stop` | Safely stop the server after player warnings. Add `-t <seconds>` or `--countdown-seconds <seconds>` to set a `60` through `900` second countdown. |
| `!stop -u` or `!stop --unsafe` | Stop the server immediately. |
| `!restart` | Safely restart after player warnings. Add `-c`/`--check-updates` to check for updates before relaunch and `-t <seconds>`/`--countdown-seconds <seconds>` to set the warning countdown. |
| `!restart -u` or `!restart --unsafe` | Restart immediately. Add `-c` or `--check-updates` to check for updates before relaunch. |

Safe `!stop` and `!restart` require RCON so players can be warned. If RCON is unavailable, the terminal returns guidance
to use `--unsafe`/`-u` instead of silently falling back to an immediate action.

| Argument                      | Description                                                        | Default                                      |
|-------------------------------|--------------------------------------------------------------------|----------------------------------------------|
| `PORTAL_AUTH_PROVIDER`        | `auto`, `local`, `oidc`, or `oauth2`.                              | `auto`                                       |
| `PORTAL_HOST`                 | Portal bind address.                                               | `0.0.0.0`                                    |
| `PORTAL_PORT`                 | Portal HTTP port.                                                  | `8080`                                       |
| `PORTAL_AUTO_START`           | Start Project Zomboid after preparation completes.                 | `true`                                       |
| `PORTAL_DB_PATH`              | SQLite database path.                                              | `/home/steam/Zomboid/portal/portal.sqlite`   |
| `PORTAL_PUBLIC_SERVER_NAME`   | Public status page server name. Falls back to `SERVER_NAME`.       | `Project Zomboid Server`                     |
| `PORTAL_PUBLIC_DESCRIPTION`   | Optional public description shown before sign-in.                  |                                              |
| `PORTAL_ADMIN_USERNAME`       | Protected local bootstrap operator username.                       | `admin`                                      |
| `PORTAL_ADMIN_PASSWORD`       | Local password to create/update the bootstrap operator.            | required for first local-auth run            |
| `PORTAL_SESSION_SECRET`       | Secret used for portal session cookies.                            | random on each container start if omitted    |
| `PORTAL_SESSION_COOKIE`       | Session cookie name.                                               | `pz_portal_session`                          |
| `PORTAL_SESSION_TTL_SECONDS`  | Session lifetime in seconds.                                       | `43200`                                      |
| `PORTAL_SECURE_COOKIES`       | Mark session cookies `Secure`; enable behind HTTPS.                | `false`                                      |
| `PORTAL_LOG_LINES`            | Number of timestamped log lines retained in memory.                | `1000`                                       |
| `PORTAL_SAFE_ACTION_COUNTDOWN_SECONDS` | Default seconds used for safe stop/restart warning countdown. | `300`                                      |
| `PORTAL_RCON_HOST`            | Optional RCON host override for portal safe actions, metrics, and terminal commands. |                                |
| `PORTAL_RCON_HOST_FILE`       | File containing the detected RCON host.                            | `/home/steam/Zomboid/ip.txt`                 |
| `PORTAL_RCON_BINARY`          | RCON CLI binary used by the portal.                                | `rcon`                                       |
| `PORTAL_ALLOWED_USERS`        | Comma-separated external IdP usernames allowed into the portal.    |                                              |
| `PORTAL_ALLOWED_EMAILS`       | Comma-separated external IdP emails allowed into the portal.       |                                              |
| `PORTAL_ALLOWED_GROUPS`       | Comma-separated external IdP groups allowed into the portal.       |                                              |
| `PORTAL_OPERATOR_GROUPS`      | External IdP groups mapped to the `operator` role.                 |                                              |
| `PORTAL_ADMIN_GROUPS`         | External IdP groups mapped to the `admin` role.                    |                                              |
| `PORTAL_READ_ONLY_GROUPS`     | External IdP groups mapped to the `read_only` role.                |                                              |
| `PORTAL_USERNAME_CLAIM`       | External IdP claim used as the portal username.                    | `preferred_username`                         |
| `PORTAL_EMAIL_CLAIM`          | External IdP claim used as the portal email.                       | `email`                                      |
| `PORTAL_GROUPS_CLAIM`         | External IdP claim used for group authorization.                   | `groups`                                     |

External role precedence is `operator` > `admin` > `read_only`. If an allowed external user matches no role group, the
portal assigns `admin` to preserve the previous external-auth behavior.

The public landing page is `GET /`; the authenticated management dashboard is `GET /manage`. The public endpoint is
`GET /api/public/status` and does not require a session. It follows the whitelist described above and returns only the
public server name, optional description, high-level state, readiness, update timestamp, and safe aggregate RCON metrics
when available.

OIDC configuration:

| Argument                    | Description                                           |
|-----------------------------|-------------------------------------------------------|
| `PORTAL_OIDC_ISSUER_URL`    | OIDC issuer URL with discovery metadata.              |
| `PORTAL_OIDC_CLIENT_ID`     | OIDC client ID.                                       |
| `PORTAL_OIDC_CLIENT_SECRET` | OIDC client secret.                                   |
| `PORTAL_OIDC_REDIRECT_URI`  | Redirect URI, usually `https://host/auth/callback`.   |
| `PORTAL_OIDC_SCOPE`         | Requested scopes.                                     |

Generic OAuth2 configuration:

| Argument                      | Description                                           |
|-------------------------------|-------------------------------------------------------|
| `PORTAL_OAUTH_AUTHORIZE_URL`  | Authorization endpoint.                               |
| `PORTAL_OAUTH_TOKEN_URL`      | Token endpoint.                                       |
| `PORTAL_OAUTH_USERINFO_URL`   | Userinfo/profile endpoint returning JSON claims.      |
| `PORTAL_OAUTH_CLIENT_ID`      | OAuth2 client ID.                                     |
| `PORTAL_OAUTH_CLIENT_SECRET`  | OAuth2 client secret.                                 |
| `PORTAL_OAUTH_REDIRECT_URI`   | Redirect URI, usually `https://host/auth/callback`.   |
| `PORTAL_OAUTH_SCOPE`          | Requested scopes.                                     |

## Instructions

The server can be run using plain Docker, or using Docker-Compose. The end-result is the same, but Docker-Compose is
recommended for ease of configuration.

### Optional environment variables

| Argument         | Description                                  | Values            | Default       |
| ---------------- | -------------------------------------------- | ----------------- | ------------- |
| `ADMIN_PASSWORD` | Server Admin account password                | [a-zA-Z0-9]+      | changeme      |
| `ADMIN_USERNAME` | Server Admin account username                | [a-zA-Z0-9]+      | superuser     |
| `BIND_IP`        | IP to bind the server to                     | 0.0.0.0           | 0.0.0.0       |
| `GAME_VERSION`   | Game version to serve                        | [a-zA-Z0-9_]+     | `public`      |
| `GC_CONFIG`      | Specifies Java GC to use                     | [a-zA-Z0-9_]+     | ZGC           |
| `MAP_NAMES`      | Map Names (e.g. North;South)                 | map1;map2;map3    | Muldraugh, KY |
| `MAX_RAM`        | Maximum amount of RAM to be used             | ([0-9]+)m         | 4096m         |
| `STEAM_VAC`      | Use Steam VAC anti-cheat                     | (true&vert;false) | true          |
| `TZ`             | Set the timezone for the container           | [A-Z]+            | UTC           |
| `USE_STEAM`      | Create a Steam Server, or a Non-Steam Server | (true&vert;false) | true          |

### Config file environment variables

The following environment variables will automatically overwrite values in the server's config.ini file (located
at `/home/steam/Zomboid/Server/[name].ini`).
Editing these values directly in the .ini file will result in them being overwritten with either the default value, or
the configured environment variable.

Any other values *can* and *should* be edited directly in the .ini file.

| Argument            | Description                                                                                                                             | .ini variable         | Values                 | Default       |
|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------| --------------------- | ---------------------- | ------------- |
| `AUTOSAVE_INTERVAL` | Interval between autosaves in minutes                                                                                                   | SaveWorldEveryMinutes | [0-9]+                 | 15m           |
| `DEFAULT_PORT`      | Port for other players to connect to                                                                                                    | DefaultPort           | 1000 - 65535           | 16261         |
| `MAX_PLAYERS`       | Maximum players allowed in the Server                                                                                                   | MaxPlayers            | [0-9]+                 | 16            |
| `MOD_NAMES`         | Workshop Mod Names (e.g. ClaimNonResidential;MoreDescriptionForTraits)                                                                  | Mods                  | mod1;mod2;mod          |               |
| `MOD_WORKSHOP_IDS`  | Workshop Mod IDs (e.g. 2160432461;2685168362)                                                                                           | WorkshopItems         | 2160432461;2685168362; |               |
| `PAUSE_ON_EMPTY`    | Pause the Server when no Players are connected                                                                                          | PauseEmpty            | (true&vert;false)      | true          |
| `PUBLIC_SERVER`     | If set to `false` only Pre-Approved/Allowed players can join the server (**NOTE:** Do not confuse with the `Public` option in the .ini) | Open                  | (true&vert;false)      | true          |
| `RCON_PASSWORD`     | Password for authenticating incoming RCON commands                                                                                      | RCONPassword          | nonempty string        | changeme_rcon |
| `RCON_PORT`         | Port to listen on for RCON commands. Set to `0` to disable RCON-backed safe warnings, metrics, and terminal RCON commands.                 | RCONPort              | 0 or 1000 - 65535      | 27015         |
| `SERVER_NAME`       | Publicly visible Server Name                                                                                                            | PublicName            | [a-zA-Z0-9]+           | ZomboidServer |
| `SERVER_PASSWORD`   | Server password                                                                                                                         | Password              | [a-zA-Z0-9]+           |               |
| `UDP_PORT`          | Additional Port for facilitating Client connections                                                                                     | UDPPort               | 1000 - 65535           | 16262         |

### Docker

The following are instructions for running the server using the Docker image.

1. Acquire the image locally:

    - Pull the image from DockerHub:

      ```shell
      docker pull renegademaster/zomboid-dedicated-server:<tagname>
      ```

    - Or alternatively, build the image:

      ```shell
      git clone https://github.com/Renegade-Master/zomboid-dedicated-server.git \
          && cd zomboid-dedicated-server

      docker build -t docker.io/renegademaster/zomboid-dedicated-server:<tag> -f docker/zomboid-dedicated-server.Dockerfile .
      ```

2. Run the container:

   **\*Note**: Arguments inside square brackets are optional. If the default ports are to be overridden, then the
   `published` ports below must also be changed\*

   ```shell
   mkdir ZomboidConfig ZomboidDedicatedServer

   docker run --detach \
       --mount type=bind,source="$(pwd)/ZomboidDedicatedServer",target=/home/steam/ZomboidDedicatedServer \
       --mount type=bind,source="$(pwd)/ZomboidConfig",target=/home/steam/Zomboid \
       --publish 16261:16261/udp --publish 16262:16262/udp [--publish 27015:27015/tcp] \
       --publish 8080:8080/tcp \
       --name zomboid-server \
       [--restart=no] \
       [--env=ADMIN_PASSWORD=<value>] \
       [--env=ADMIN_USERNAME=<value>] \
       [--env=AUTOSAVE_INTERVAL=<value>] \
       [--env=BIND_IP=<value>] \
       [--env=DEFAULT_PORT=<value>] \
       [--env=GAME_VERSION=<value>] \
       [--env=GC_CONFIG=<value>] \
       [--env=MAP_NAMES=<value>] \
       [--env=MAX_PLAYERS=<value>] \
       [--env=MAX_RAM=<value>] \
       [--env=MOD_NAMES=<value>] \
       [--env=MOD_WORKSHOP_IDS=<value>] \
       [--env=PAUSE_ON_EMPTY=<value>] \
       [--env=PORTAL_ADMIN_PASSWORD=<value>] \
       [--env=PORTAL_ADMIN_USERNAME=<value>] \
       [--env=PORTAL_AUTH_PROVIDER=<value>] \
       [--env=PORTAL_AUTO_START=<value>] \
       [--env=PORTAL_SESSION_SECRET=<value>] \
       [--env=PUBLIC_SERVER=<value>] \
       [--env=UDP_PORT=<value>] \
       [--env=RCON_PASSWORD=<value>] \
       [--env=RCON_PORT=<value>] \
       [--env=SERVER_NAME=<value>] \
       [--env=SERVER_PASSWORD=<value>] \
       [--env=STEAM_VAC=<value>] \
       [--env=TZ=<value>] \
       [--env=USE_STEAM=<value>] \
       docker.io/renegademaster/zomboid-dedicated-server[:<tagname>]
   ```

3. Optionally, reattach the terminal to the log output (**\*Note**: this is not an Interactive Terminal\*)

   ```shell
   docker logs --follow zomboid-server
   ```

4. Once you see `LuaNet: Initialization [DONE]` in the console, people can start to join the server.

5. Open the public portal landing page at `http://localhost:8080` and sign in with `PORTAL_ADMIN_USERNAME` and
   `PORTAL_ADMIN_PASSWORD`; the management dashboard opens at `http://localhost:8080/manage`.

### Docker-Compose

The following are instructions for running the server using Docker-Compose.

1. Download the repository:

   ```shell
   git clone https://github.com/Renegade-Master/zomboid-dedicated-server.git \
       && cd zomboid-dedicated-server
   ```

2. Make any configuration changes you want to in the `docker-compose.yaml` file. In
   the `services.zomboid-server.environment` section, you can change values for the server configuration.

   **\*Note**: If the default ports are to be overridden, then the `published` ports must also be changed\*

3. Run the following commands:

    - Make the data and configuration directories:

      ```shell
      mkdir ZomboidConfig ZomboidDedicatedServer
      ```

    - Pull the image from DockerHub:

      ```shell
      docker-compose up --detach
      ```

    - Or alternatively, build the image:

      ```shell
      docker-compose up --build --detach
      ```

4. Optionally, reattach the terminal to the log output (**\*Note**: this is not an Interactive Terminal\*)

   ```shell
   docker-compose logs --follow
   ```

5. Once you see `LuaNet: Initialization [DONE]` in the console, people can start to join the server.

6. Open the public portal landing page at `http://localhost:8080` and sign in with `PORTAL_ADMIN_USERNAME` and
   `PORTAL_ADMIN_PASSWORD`; the management dashboard opens at `http://localhost:8080/manage`.

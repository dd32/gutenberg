/**
 * External dependencies
 */
const path = require( 'path' );
const fs = require( 'fs' ).promises;
const yaml = require( 'js-yaml' );

/**
 * Internal dependencies
 */
const { readConfig } = require( './config' );
const buildDockerComposeConfig = require( './build-docker-compose-config' );

/**
 * @typedef {import('./config').WPConfig} WPConfig
 */

/**
 * Initializes the local environment so that Docker commands can be run. Reads
 * ./.wp-env.json, creates ~/.wp-env, and creates ~/.wp-env/docker-compose.yml.
 *
 * @param {Object}  options
 * @param {Object}  options.spinner A CLI spinner which indicates progress.
 * @param {boolean} options.debug   True if debug mode is enabled.
 *
 * @return {WPConfig} The-env config object.
 */
module.exports = async function initConfig( { spinner, debug } ) {
	const configPath = path.resolve( '.wp-env.json' );
	const config = await readConfig( configPath );
	config.debug = debug;

	await fs.mkdir( config.workDirectoryPath, { recursive: true } );

	// Set the www-data user within the container to that which started the env.
	const dockerfile = "ARG TARGET_UID\n" +
		"ARG TARGET_GID\n\n" +
		"RUN " +
			"( which apk ) && apk add --no-cache shadow; \\\n" + // Alpine images need shadow for usermod/groupmod
			"EXISTING_USER=$( getent passwd $TARGET_UID | cut -d: -f1 ); \\\n" +
			"EXISTING_GROUP=$( getent group $TARGET_GID | cut -d: -f1 ); \\\n" +
			'( test "$EXISTING_USER" && test "$EXISTING_USER" != "www-data" ) && usermod -u 9999 $EXISTING_USER ;\\\n' +
			'( test "$EXISTING_GROUP" && test "$EXISTING_GROUP" != "www-data" ) && groupmod -g 9999 $EXISTING_GROUP ;\\\n' +
			'groupmod -g $TARGET_GID www-data ;\\\n' +
			'usermod -u $TARGET_UID -g $TARGET_GID www-data ;\\\n' +
			"chown -R www-data:www-data /var/www/html\n";

	await fs.writeFile(
		config.wordpressDockerfile,
		"FROM wordpress\n" + dockerfile
	);
	await fs.writeFile(
		config.cliDockerfile,
		"FROM wordpress:cli\n" + dockerfile
	);

	const dockerComposeConfig = buildDockerComposeConfig( config );
	await fs.writeFile(
		config.dockerComposeConfigPath,
		yaml.dump( dockerComposeConfig )
	);

	if ( config.debug ) {
		spinner.info(
			`Config:\n${ JSON.stringify(
				config,
				null,
				4
			) }\n\nDocker Compose Config:\n${ JSON.stringify(
				dockerComposeConfig,
				null,
				4
			) }`
		);
		spinner.start();
	}

	return config;
};

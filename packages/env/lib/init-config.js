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
			"EXISTING_USER=$( getent passwd $TARGET_UID | cut -d: -f1 | grep -Ev '(root|www-data)' ); \\\n" + // Find any existing users, other than root and www-data who are using that ID.
			"EXISTING_GROUP=$( getent group $TARGET_GID | cut -d: -f1 | grep -Ev '(root|www-data)' ); \\\n" +
			'( test -n "$EXISTING_USER" ) && usermod -u 9999 $EXISTING_USER; \\\n' + // If there's an existing user/group using those IDs, alter their ID to 9999.
			'( test -n "$EXISTING_GROUP" ) && groupmod -g 9999 $EXISTING_GROUP; \\\n' +
			'( test -n "$TARGET_GID" && test $TARGET_GID -gt 0 ) && groupmod -g $TARGET_GID www-data; \\\n' + // Change the Group ID of www-data to that of the wp-env user.
			'( test -n "$TARGET_UID" && test $TARGET_UID -gt 0 ) && usermod -u $TARGET_UID -g $TARGET_GID www-data; \\\n' + // Change the User ID & add them to the www-data group to that of the wp-env user.
			"chown -R www-data:www-data /var/www/html\n"; // Reset ownership of the files in the html directory, if needed, this is mostly here as the parent image may have set chown'd to the old www-data IDs.

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

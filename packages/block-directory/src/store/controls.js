/**
 * Load an asset for a block
 *
 * @param {HTMLElement} el A HTML Element asset to inject.
 *
 * @return {Promise} Promise which will resolve when the asset is loaded.
 */
export const loadAsset = ( el ) => {
	return new Promise( ( resolve, reject ) => {
		// const newNode = el.cloneNode( true ); // <script> elements don't trigger onload.
		const newNode = document.createElement( el.nodeName );

		[ 'id', 'rel', 'src', 'href', 'type' ].forEach( ( attr ) => {
			if ( el[ attr ] ) {
				newNode[ attr ] = el[ attr ];
			}
		} );

		// Append inline <script> contents.
		if ( el.innerHTML ) {
			newNode.appendChild( document.createTextNode( el.innerHTML ) );
		}

		newNode.onload = () => resolve( true );
		newNode.onerror = () => reject( new Error( 'Error loading asset.' ) );

		document.body.appendChild( newNode );

		// Resolve <link rel="stlesheet"> and inline <script> immediately.
		if ( 'link' === newNode.nodeName || ( 'script' === newNode.nodeName && ! newNode.src ) ) {
			resolve();
		}

	} );
};

/**
 * Load the asset files for a block
 *
 * @param {Array} assets A collection of URLs for the assets.
 *
 * @return {Object} Control descriptor.
 */
export function loadAssets( assets ) {
	return {
		type: 'LOAD_ASSETS',
		assets,
	};
}

const controls = {
	LOAD_ASSETS() {
		return window
			.fetch( document.location )
			.then( ( response ) => response.text() )
			.then( ( data ) => {
				const doc = new window.DOMParser().parseFromString(
					data,
					'text/html'
				);

				const newAssets = Array.from(
					doc.querySelectorAll( 'link[rel="stylesheet"],script' )
				).filter(
					( asset ) =>
						asset.id && ! document.getElementById( asset.id )
				);

				return new Promise( async ( resolve, reject ) => {
					for ( const i in newAssets ) {
						try {
							await loadAsset( newAssets[ i ] );
						} catch ( e ) {
							reject( e );
						}
					}
					resolve();
				} );
			} );
	},
};

export default controls;

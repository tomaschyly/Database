const mongodb = require ('mongodb');

class MongoDB {
	/**
	 * MongoDB connection initialization.
	 */
	constructor (config) {
		this.client = mongodb.MongoClient;
		this.url = config.mongodb.url;
		
		this.queryInProgress = {};
	}
}

module.exports = MongoDB;

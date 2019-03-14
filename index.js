const path = require ('path');
const util = require ('util');
const clone = require ('clone');

const ENGINE_TYPES = Object.freeze ({
	'MySQL': 'mysql',
	'MongoDB': 'mongodb',
	'NeDB': 'nedb'
});

const WHERE_CONDITIONS = Object.freeze ({
	'Equal': 1,
	'Like': 2
});

const ConfigTemplate = Object.freeze ({
	db: {
		host: '',
		port: 3312,
		username: '',
		password: '',
		database: '',
		ssl: false
	},
	storageSystem: ENGINE_TYPES.NeDB,
	mongodb: {
		url: ''
	},
	nedb: {
		directory: path.join ('var', 'nedb')
	}
});

class Database {
	/**
	 * Database connection initialization.
	 */
	constructor (config) {
		if (typeof (config) !== 'object') {
			throw Error ('Configuration is required to create database connection');
		}

		this.storageSystem = config.storageSystem;

		switch (this.storageSystem) {
			case 'mysql': {
				const MySQL = require ('./engine/MySQL');
				this.engine = new MySQL (config);
				break;
			}
			case 'mongodb': {
				const MongoDB = require ('./engine/MongoDB');
				this.engine = new MongoDB (config);
				break;
			}
			case 'nedb': {
				const NeDB = require ('./engine/NeDB');
				this.engine = new NeDB (config);
				break;
			}
			default:
				throw Error ('Not supported Engine');
		}
	}

	/**
	 * Add selection with table to current query.
	 */
	SelectTable (select, table) {
		this.engine.queryInProgress.select = select;

		switch (this.storageSystem) {
			case 'mongodb':
			case 'nedb':
				this.engine.queryInProgress.collection = table;
				break;
			default:
				this.engine.queryInProgress.table = table;
		}

		return this;
	}

	/**
	 * Add where condition to current query.
	 */
	Where (key, condition, value) {
		if (typeof (this.engine.queryInProgress.where) === 'undefined') {
			this.engine.queryInProgress.where = {};
		}

		this.engine.queryInProgress.where [key] = {
			condition: condition,
			value: value
		};

		return this;
	}

	/**
	 * Set sort on current query.
	 */
	Sort (key, direction) {
		this.engine.queryInProgress.sort = key;
		this.engine.queryInProgress.sortDirection = direction;

		return this;
	}

	/**
	 * Set limit and offset on current query.
	 */
	LimitOffset (limit, offset) {
		if (parseInt (limit) > 0) {
			this.engine.queryInProgress.limit = limit;
			
			if (parseInt (offset) > 0) {
				this.engine.queryInProgress.offset = offset;
			}
		}

		return this;
	}

	/**
	 * Fetch single result for current query.
	 */
	async Fetch () {
		let result = null;
		
		this.engine.queryInProgress.limit = 1;

		switch (this.storageSystem) {
			case 'mysql': {
				let sql = this.engine.QueryToSql ();
	
				result = await this.engine.RawQuery (sql);
				if (result.length > 0) {
					result = result.shift ();
				} else {
					result = null;
				}
				break;
			}
			case 'mongodb':
				//TODO
				break;
			case 'nedb': {
				let datastore = this.engine.Datastore ();
	
				let cursor = datastore.find (this.engine.Parameters ());
				cursor.exec = util.promisify (cursor.exec);
				
				cursor = this.engine.Sort (cursor);
	
				cursor = this.engine.LimitOffset (cursor);
	
				result = await cursor.exec ();
			
				if (result.length > 0) {
					result = result.shift ();
	
					result = clone (result);
	
					for (let index in result) {
						if (result.hasOwnProperty (index)) {
							if (index === '_id') {
								result ['id'] = result [index];
								delete result [index];
							}
						}
					}
				} else {
					result = null;
				}
				break;
			}
		}

		return result;
	}

	/**
	 * Fetch all results for current query.
	 */
	async FetchAll () {
		let results = [];

		switch (this.storageSystem) {
			case 'mysql': {
				let sql = this.engine.QueryToSql ();
	
				results = await this.engine.RawQuery (sql);
				break;
			}
			case 'mongodb':
				//TODO
				break;
			case 'nedb': {
				let datastore = this.engine.Datastore ();
	
				let cursor = datastore.find (this.engine.Parameters ());
				cursor.exec = util.promisify (cursor.exec);
				
				cursor = this.engine.Sort (cursor);
	
				cursor = this.engine.LimitOffset (cursor);
	
				results = await cursor.exec ();
	
				for (let i = 0; i < results.length; i++) {
					results [i] = clone (results [i]);
	
					for (let index in results [i]) {
						if (results [i].hasOwnProperty (index)) {
							if (index === '_id') {
								results [i] ['id'] = results [i] [index];
								delete results [i] [index];
							}
						}
					}
				}
				break;
			}
		}

		return results;
	}

	/**
	 * Get list of tables in database.
	 */
	async FetchTables () {
		let tables = [];

		switch (this.storageSystem) {
			case 'mysql': {
				let sql = this.engine.TablesQuery ();

				let rows = await this.engine.RawQuery (sql);

				for (let i = 0; i < rows.length; i++) {
					tables.push (rows [i].table_name);
				}
				break;
			}
			case 'mongodb':
				//TODO
				break;
			case 'nedb': 
				//TODO
				break;
		}

		return tables;
	}

	/**
	 * Get count of results for current query.
	 */
	async Count () {
		let count = 0;

		switch (this.storageSystem) {
			case 'mysql':
				//TODO
				break;
			case 'mongodb':
				//TODO
				break;
			case 'nedb': {
				let datastore = this.engine.Datastore ();
				datastore.count = util.promisify (datastore.count);
	
				count = await datastore.count (this.engine.Parameters ());
				break;
			}
		}

		return count;
	}

	/**
	 * Insert one or more items using current query.
	 */
	async Insert (rows) {
		if (!Array.isArray (rows)) {
			rows = [rows];
		}

		let results = [];
		
		this.engine.queryInProgress.rows = [];
		for (let i = 0; i < rows.length; i++) {
			this.engine.queryInProgress.rows.push (clone (rows [i]));
		}

		switch (this.storageSystem) {
			case 'mysql': {
				let sql = this.engine.QueryToSql ('insert');
	
				if (this.engine.queryInProgress.rows.length > 1) {
					results = await this.engine.RawQueries (sql.split ('\n'));
				} else {
					results = [await this.engine.RawQuery (sql)];
				}

				for (let i = 0; i < results.length; i++) {
					if (results [i] !== null) {
						results [i] = results [i].insertId;
					}
				}
				break;
			}
			case 'mongodb':
				//TODO
				//TODO results will need to be parsed here for unified response from here
				break;
			case 'nedb': {
				let datastore = this.engine.Datastore ();
	
				for (let i = 0; i < this.engine.queryInProgress.rows.length; i++) {
					for (let index in this.engine.queryInProgress.rows [i]) {
						if (this.engine.queryInProgress.rows [i].hasOwnProperty (index)) {
							if (index === '_id' || index === 'id') {
								delete this.engine.queryInProgress.rows [i] [index];
							}
						}
					}
				}
	
				results = await datastore.insert (this.engine.queryInProgress.rows);
	
				for (let i = 0; i < results.length; i++) { 
					results [i] = results [i] ['_id'];
				}
				break;
			}
		}

		return results;
	}

	/**
	 * Update one item using current query.
	 */
	async Update (row) {
		if (Array.isArray (row)) {
			throw Error ('Update only one item at a time');
		}

		row = clone (row);

		let result = null;
		
		switch (this.storageSystem) {
			case 'mysql':
				//TODO
				//TODO results will need to be parsed here for unified response from here
				break;
			case 'mongodb':
				//TODO
				//TODO results will need to be parsed here for unified response from here
				break;
			case 'nedb': {
				let datastore = this.engine.Datastore ();
				datastore.update = util.promisify (datastore.update);
	
				for (let index in row) {
					if (row.hasOwnProperty (index)) {
						if (index === '_id' || index === 'id') {
							delete row [index];
						}
					}
				}
	
				result = await datastore.update (this.engine.Parameters (), row, {multi: false, upsert: false});
	
				result = result === 1;
				break;
			}
		}

		return result;
	}

	/**
	 * Delete items matching current query.
	 */
	async Delete () {
		let result = false;

		switch (this.storageSystem) {
			case 'mysql':
				//TODO
				//TODO results will need to be parsed here for unified response from here
				break;
			case 'mongodb':
				//TODO
				//TODO results will need to be parsed here for unified response from here
				break;
			case 'nedb': {
				let datastore = this.engine.Datastore ();
				datastore.remove = util.promisify (datastore.remove);

				result = await datastore.remove (this.engine.Parameters (), {multi: true});

				result = result >= 1;
				break;
			}
		}

		return result;
	}
}

module.exports = {
	ConfigTemplate,
	Database,
	ENGINE_TYPES,
	WHERE_CONDITIONS
};

const nedb = require ('nedb');
const util = require ('util');
const electron = require ('electron');
const {WHERE_CONDITIONS} = require ('../index');

class NeDB {
	/**
	 * NeDB connection initialization.
	 */
	constructor (config) {
		this.autoload = true;
		this.autocompactionInterval = 15 * 60 * 1000;
		this.directory = config.nedb.directory;
		
		this.queryInProgress = {};
	}

	/**
	 * Get Datastore (Collection).
	 */
	Datastore () {
		let collection = new nedb ({
			filename: `${(electron.app || electron.remote.app).getPath ('userData')}/${this.directory}/${this.queryInProgress.collection}.db`,
			autoload: this.autoload
		});
		
		collection.persistence.setAutocompactionInterval (this.autocompactionInterval);

		collection.insert = util.promisify (collection.insert);
		//TODO promisify methods? for async to work!

		return collection;
	}

	/**
	 * Create NeDB parameters from current query.
	 */
	Parameters () {
		let params = {};

		if (typeof (this.queryInProgress.where) !== 'undefined') {
			for (let index in this.queryInProgress.where) {
				if (this.queryInProgress.where.hasOwnProperty (index)) {
					let row = this.queryInProgress.where [index];

					switch (row.condition) {
						case WHERE_CONDITIONS.Equal:
							params [(index === 'id' ? '_id' : index)] = row.value;
							break;
						case WHERE_CONDITIONS.Like:
							params [(index === 'id' ? '_id' : index)] = new RegExp (row.value, 'g');
							break;
						default:
							throw Error ('Not supported Parameters where condition');
					}
				}
			}
		}

		return params;
	}

	/**
	 * Set sort from current query.
	 */
	Sort (cursor) {
		if (typeof (this.queryInProgress.sort) === 'string' && typeof (this.queryInProgress.sortDirection) === 'string') {
			let sort = {};
			switch (this.queryInProgress.sortDirection) {
				case 'ASC':
					sort [this.queryInProgress.sort] = 1;
					break;
				case 'DESC':
					sort [this.queryInProgress.sort] = -1;
					break;
				default:
					throw Error ('Not supported Sorting direction');
			}

			cursor.sort (sort);
		}

		return cursor;
	}

	/**
	 * Set limit and offset from current query.
	 */
	LimitOffset (cursor) {
		if (typeof (this.queryInProgress.limit) === 'number') {
			let limit = parseInt (this.queryInProgress.limit);
			if (limit < 1) {
				limit = 1;
			}

			cursor.limit (limit);

			if (typeof (this.queryInProgress.offset) === 'number') {
				let offset = parseInt (this.queryInProgress.offset);

				if (offset > 0) {
					cursor.skip (offset);
				}
			}
		}

		return cursor;
	}
}

module.exports = NeDB;

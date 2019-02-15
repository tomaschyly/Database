const mysql = require ('mysql');
const util = require ('util');
const {WHERE_CONDITIONS} = require ('../index');

class MySQL {
	/**
	 * MySQL connection initialization.
	 */
	constructor (config) {
		this.config = config;

		this.connection = mysql.createConnection ({
			host: config.db.host,
			port: config.db.port,
			user: config.db.username,
			password: config.db.password,
			database: config.db.database,
			ssl: config.db.ssl
		});

		this.connection.query = util.promisify (this.connection.query);

		this.queryInProgress = {};
	}

	/**
	 * Construct sql query from current query.
	 */
	QueryToSql (type = 'select') {
		let sql = '';
		
		switch (type) {
			case 'select':
				sql = `SELECT ${this.queryInProgress.select} FROM \`${this.queryInProgress.table}\``;
				break;
			case 'insert':
				for (let i = 0; i < this.queryInProgress.rows.length; i++) {
					let columns = [];
					let values = [];

					for (let index in this.queryInProgress.rows [i]) {
						columns.push (index);

						let value = this.queryInProgress.rows [i] [index];
						if (typeof (value) === 'number') {
							values.push (mysql.escape (value));
						} else {
							values.push (`${mysql.escape (value)}`);
						}
					}

					sql += `INSERT INTO \`${this.queryInProgress.table}\` (${columns.join (', ')}) VALUES (${values.join (', ')});\n`;
				}
				break;
			default:
				throw Error ('Not supported QueryToSql type');
		}

		if (typeof (this.queryInProgress.where) !== 'undefined') {
			let where = [];

			for (let index in this.queryInProgress.where) {
				if (this.queryInProgress.where.hasOwnProperty (index)) {
					let row = this.queryInProgress.where [index];

					switch (row.condition) {
						case WHERE_CONDITIONS.Equal:
							where.push (`${index} = ${mysql.escape (row.value)}`);
							break;
						default:
							throw Error ('Not supported QueryToSql where condition');
					}
				}
			}

			if (where.length > 0) {
				sql += ` WHERE ${where.join (' AND ')}`;
			}
		}

		//TODO order

		if (typeof (this.queryInProgress.limit) === 'number') {
			let limit = parseInt (this.queryInProgress.limit);
			if (limit < 1) {
				limit = 1;
			}

			sql += ` LIMIT ${limit}`;

			if (typeof (this.queryInProgress.offset) === 'number') {
				let offset = parseInt (this.queryInProgress.offset);

				if (offset > 0) {
					sql += ` OFFSET ${offset}`;
				}
			}
		}

		return sql;
	}

	/**
	 * Query to list tables of database.
	 */
	TablesQuery () {
		return `SELECT table_name FROM information_schema.tables where table_schema='${this.config.db.database}';`;
	}

	/**
	 * Send single raw query.
	 */
	async RawQuery (query) {
		this.connection.connect ();

		let results = await this.connection.query (query);

		this.connection.end ();

		return results;
	}

	/**
	 * Send multiple raw queries.
	 */
	async RawQueries (queries) {
		this.connection.connect ();

		let results = [];
		for (let i = 0; i < queries.length; i++) {
			if (queries [i] !== '') {
				results.push (await this.connection.query (queries [i]));
			}
		}
		
		this.connection.end ();

		return results;
	}
}

module.exports = MySQL;

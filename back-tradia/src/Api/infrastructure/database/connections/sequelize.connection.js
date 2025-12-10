const { Sequelize } = require('sequelize');
const config = require('../../../shared/config/database.config');
const ensureUserSchema = require('../migrations/ensureUserSchema');

class DatabaseConnection {
    static instance = null;

    constructor() {
        if (!DatabaseConnection.instance) {
            this.sequelize = new Sequelize(config.development);
            DatabaseConnection.instance = this;
        }
        return DatabaseConnection.instance;
    }

    static getInstance() {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }

    getConnection() {
        return this.sequelize;
    }

    async authenticate() {
        try {
            await this.sequelize.authenticate();
            console.log('Conexión a la base de datos establecida correctamente.');
        } catch (error) {
            console.error('No se pudo conectar a la base de datos:', error);
            throw error;
        }
    }

    async syncModels() {
        const shouldAutoAlter =
            (process.env.DB_AUTO_MIGRATE || "").toLowerCase() === "true";

        try {
            await ensureUserSchema(this.sequelize);
            if (shouldAutoAlter) {
                await this.sequelize.sync({ alter: true });
                console.log('Modelos sincronizados con alter (DB_AUTO_MIGRATE=true).');
            } else {
                await this.sequelize.sync();
                console.log('Modelos verificados (sin alter).');
            }
        } catch (error) {
            console.error('Error al sincronizar modelos:', error);
            throw error;
        }
    }

    async close() {
        if (this.sequelize) {
            await this.sequelize.close();
            DatabaseConnection.instance = null;
        }
    }
}

module.exports = DatabaseConnection;

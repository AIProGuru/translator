const { DataTypes } = require("sequelize");
const sequelize = require("../connections/sequelize.connection").getInstance().getConnection();

const Process = sequelize.define(
    "Process",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [2, 100],
            },
        },
        status: {
            type: DataTypes.ENUM(
                "pending",
                "upload",
                "processing",
                "translating",
                "completed",
                "error",
                "canceled"
            ),
            allowNull: false,
            defaultValue: "pending",
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        startTime: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "start_time",
        },
        endTime: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "end_time",
        },
        error: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        html: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        pages_info: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        config: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: {},
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user",
                key: "id",
            },
        },
    },
    {
        tableName: "processes",
        timestamps: true,
        underscored: true,
        indexes: [
            {
                name: "idx_status",
                fields: ["status"],
            },
            {
                name: "idx_created_at",
                fields: ["created_at"],
            },
        ],
    }
);

Process.beforeCreate(async (process) => {
    if (["processing", "pending"].includes(process.status)) {
        if (!process.startTime) {
            process.startTime = new Date();
        }
    }
});

Process.beforeUpdate(async (process) => {
    if (["completed", "error", "canceled"].includes(process.status)) {
        process.endTime = new Date();
    }
    if (process.status === "processing" && !process.startTime) {
        process.startTime = new Date();
    }
});

Process.afterUpdate(async (process) => {
    console.log(`🛠️ Proceso actualizado (ID: ${process.id}):`);
    console.log(`Estado actual: ${process.status}`);
    console.log(`Start time: ${process.startTime}`);
    console.log(`End time: ${process.endTime}`);
});

Process.prototype.getDuration = function() {
    return this.startTime && this.endTime ? this.endTime - this.startTime : null;
};

Process.prototype.isCompleted = function() {
    return this.status === "completed";
};

Process.prototype.hasError = function() {
    return this.status === "error";
};

Process.findRecent = function(limit = 10) {
    return this.findAll({
        order: [["created_at", "DESC"]],
        limit,
    });
};

module.exports = Process;

const appJson = require('./app.json');

module.exports = () => {
    const baseExpoConfig = appJson.expo;
    const baseUrl = process.env.EXPO_BASE_URL || '';

    return {
        ...baseExpoConfig,
        experiments: {
            ...(baseExpoConfig.experiments || {}),
            ...(baseUrl ? { baseUrl } : {}),
        },
    };
};

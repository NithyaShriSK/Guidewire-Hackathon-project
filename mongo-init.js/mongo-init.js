const dbName = 'gigshield';
const database = db.getSiblingDB(dbName);

// Ensure initialization remains safe on repeated starts.
if (!database.getCollectionNames().includes('init_marker')) {
  database.createCollection('init_marker');
}

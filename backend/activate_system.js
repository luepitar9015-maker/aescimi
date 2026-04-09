const db = require('./database');

// SQL to update or insert the system expiration date
const futureDate = '2030-12-31';

db.get("SELECT 1 FROM system_settings WHERE key = 'system_expiration_date'", [], (err, row) => {
    if (err) {
        console.error("Error consultando la configuración:", err);
    } else if (row) {
        db.run("UPDATE system_settings SET value = ? WHERE key = 'system_expiration_date'", [futureDate], function(err) {
            if (err) console.error("Error actualizando la fecha:", err);
            else console.log("\n[OK] Sistema activado exitosamente hasta " + futureDate);
        });
    } else {
        db.run("INSERT INTO system_settings (key, value) VALUES ('system_expiration_date', ?)", [futureDate], function(err) {
            if (err) console.error("Error insertando la fecha:", err);
            else console.log("\n[OK] Sistema activado exitosamente hasta " + futureDate);
        });
    }
});

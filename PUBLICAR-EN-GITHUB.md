# Publicar Mi Dacia Cockpit

El proyecto está preparado para GitHub Pages. El nombre recomendado para el repositorio es `mi-dacia-cockpit`.

1. Crea un repositorio vacío y público en GitHub llamado `mi-dacia-cockpit`.
2. Abre una terminal dentro de esta carpeta y ejecuta:

```powershell
git init
git branch -M main
git add .
git commit -m "Publicar Mi Dacia Cockpit"
git remote add origin https://github.com/TU_USUARIO/mi-dacia-cockpit.git
git push -u origin main
```

3. En GitHub abre **Settings → Pages** y en **Source** selecciona **GitHub Actions**.
4. Abre la pestaña **Actions** y espera a que termine `Publicar Mi Dacia Cockpit`.

La dirección será:

`https://TU_USUARIO.github.io/mi-dacia-cockpit/`

La versión de GitHub usa HTTPS, por lo que Chrome puede conceder permiso al GPS y permite instalar la PWA. El servidor local y el modo demo siguen disponibles.

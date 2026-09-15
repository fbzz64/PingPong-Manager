# Configurar Firebase para PingPong Manager

Esta guia conecta el login por correo, los roles por torneo y la sincronizacion segura. No uses el modo de prueba ni reglas publicas.

## 1. Crear el proyecto

1. Abre [Firebase Console](https://console.firebase.google.com/).
2. Pulsa **Crear un proyecto**.
3. Usa un nombre reconocible, por ejemplo `pingpong-manager-fbzz64`.
4. Google Analytics es opcional para esta aplicacion; puedes dejarlo desactivado.

## 2. Registrar la aplicacion web

1. En la pagina principal del proyecto, pulsa el icono **Web (`</>`)**.
2. Pon como alias `PingPong Manager Web`.
3. No es necesario activar Firebase Hosting: la pagina se publicara en GitHub Pages.
4. Pulsa **Registrar app** y selecciona la configuracion para usar una etiqueta `<script>`.
5. Copia solamente el objeto `firebaseConfig`, que tiene esta forma:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

No compartas ni subas un archivo de **Admin SDK**, una `private_key`, una cuenta de servicio ni tu contrasena de Google.

## 3. Activar acceso por correo

1. En el menu lateral abre **Compilacion > Authentication** (o **Security > Authentication**, segun el idioma de la consola).
2. Pulsa **Comenzar**.
3. En **Metodo de acceso**, abre **Correo electronico/contrasena**.
4. Activa la primera opcion **Correo electronico/contrasena** y guarda. No hace falta activar el enlace sin contrasena.
5. En **Configuracion > Dominios autorizados**, agrega `fbzz64.github.io` cuando GitHub Pages este publicado.

## 4. Crear Realtime Database

1. Abre **Compilacion > Realtime Database**.
2. Pulsa **Crear base de datos**.
3. Elige la region mas cercana disponible para tus usuarios.
4. Selecciona **Modo bloqueado**. No uses el modo de prueba.
5. Al terminar, vuelve a **Configuracion del proyecto > General > Tus apps** y copia nuevamente `firebaseConfig`: ahora debe incluir `databaseURL`.

## 5. Instalar las reglas seguras

Opcion sencilla desde la consola:

1. En **Realtime Database > Reglas**, reemplaza todo el contenido por el archivo [`database.rules.json`](database.rules.json) del repositorio.
2. Pulsa **Publicar**.

Opcion mediante Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only database
```

El archivo `firebase.json` ya apunta a las reglas correctas.

## 6. Entregar la configuracion web

Pega el objeto `firebaseConfig` en la conversacion o reemplaza los marcadores de `js/firebase-config.js`. Esa configuracion web no contiene la clave privada del proyecto; aun asi, los datos quedan protegidos por Authentication y las reglas del paso anterior.

## 7. Prueba esperada

1. Abre PingPong Manager y crea una cuenta.
2. Confirma el correo de verificacion recibido.
3. Inicia sesion y crea una sala segura.
4. Desde **Configuracion > Sincronizacion > Permisos**, agrega otro correo como operador o espectador.
5. Abre el enlace de invitacion en otro navegador y entra con ese mismo correo.

Un **operador** puede editar el torneo; un **espectador** solo puede visualizarlo; solo el **anfitrion** administra permisos y cierra la sala.


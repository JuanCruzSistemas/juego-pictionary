import { Component } from '@angular/core';
import { IlustracionPareja } from '../../comun/ilustracion-pareja';

/** Sin sesión y sin link: no hay forma de entrar sin la invitación. */
@Component({
  selector: 'app-entrar',
  imports: [IlustracionPareja],
  template: `
    <main class="pantalla">
      <p class="titulo logo"><span class="resaltado">Garabato</span></p>
      <app-ilustracion-pareja />
      <div class="encabezado">
        <h1 class="titulo">Abrí tu link para entrar</h1>
        <p class="cuerpo">
          Garabato se usa con el link de invitación que te pasaron. Abrilo desde este celular.
        </p>
      </div>
    </main>
  `,
  styleUrl: '../bienvenida/bienvenida.css',
})
export class EntrarPage {}

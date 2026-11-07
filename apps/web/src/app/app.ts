import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AvisoConexion } from './comun/aviso-conexion';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AvisoConexion],
  template: '<app-aviso-conexion /><router-outlet />',
})
export class App {}

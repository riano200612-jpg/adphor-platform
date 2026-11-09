export function renderMfaScreen(root, enrollmentRequired=false, enrollment=null) {
  root.innerHTML='<main id="main" class="login-shell mfa-shell"><section class="login-form-wrap"><form id="mfa-form"><h2>Verificación adicional</h2><p>Ingresa el código de tu aplicación autenticadora.</p><label>Código<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></label><p class="error" role="alert"></p><button type="submit" class="btn primary">Verificar</button><button type="button" class="btn secondary" data-action="cancel-mfa">Volver al acceso</button></form></section></main>';
  const form=root.querySelector('#mfa-form');
  if(enrollmentRequired || enrollment){
    form.querySelector('h2').textContent='Configura tu autenticador';
    form.querySelector('p').textContent='Registra ADPHOR en tu aplicación autenticadora. El acceso a los datos requiere completar esta verificación.';
    if(!enrollment){
      form.querySelector('label').hidden=true;
      form.querySelector('input').disabled=true;
      form.querySelector('button[type="submit"]').hidden=true;
      const button=document.createElement('button');button.type='button';button.className='btn primary';button.dataset.action='enroll-mfa';button.textContent='Registrar autenticador';
      form.querySelector('.error').before(button);
    }else{
      const source=enrollment.qrCode;
      const qr=source.startsWith('<svg')?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`:source;
      if(!qr.startsWith('data:image/svg+xml'))throw Error('El código QR recibido no es válido.');
      const image=document.createElement('img');image.src=qr;image.alt='Código QR privado para registrar tu autenticador ADPHOR';image.width=220;image.height=220;
      const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Configurar manualmente';const secret=document.createElement('code');secret.textContent=enrollment.secret;details.append(summary,secret);
      form.querySelector('label').before(image,details);
    }
  }
}

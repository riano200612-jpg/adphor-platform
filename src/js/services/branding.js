// ADPHOR client identity. Only same-origin, vetted static corporate assets are accepted.
// Private Drive photos, bearer tokens and external URLs must never be used in login.
export function approvedAvatarPath(value) {
 if(typeof value!=='string')return '';
 const path=value.trim();
 if(!/^\/assets\/branding\/[a-zA-Z0-9_-]+\.(?:png|webp|jpg|jpeg)$/.test(path))return '';
 return path;
}
export function loginAvatarMarkup(avatarPath='') {
 const path=approvedAvatarPath(avatarPath);
 if(!path)return '<span class="client-avatar-symbol" aria-hidden="true">AD</span>';
 return '<img class="client-avatar-image" src="'+path+'" alt="" loading="eager" decoding="async">';
}

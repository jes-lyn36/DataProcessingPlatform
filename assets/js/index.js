function component() {
  const element = document.createElement('div');
  element.innerHTML = 'Hello Vite test';
  return element;
}
document.body.appendChild(component());
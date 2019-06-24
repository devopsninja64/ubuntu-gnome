execute pathogen#infect()
syntax on
filetype plugin indent on
" NERDTree keybinding to CTRL + n
 nmap <c-n> :NERDTreeToggle<cr>
" autocmd VimEnter * NERDTree 
" autocmd VimEnter * if argc() | wincmd p | endif

"autocmd StdinReadPre * let s:std_in=1
"autocmd VimEnter * if argc() == 0 && !exists(“s:std_in”) | NERDTree | endif

autocmd bufenter * if (winnr("$") == 2 && exists("b:NERDTreeType") && b:NERDTreeType == "primary") | q | endif
"autocmd bufenter * if (winnr("$") == 1 && exists("b:NERDTree") && b:NERDTree.isTabTree()) | q | endif
"autocmd bufenter * if (winnr(“$”) == 1 && exists(“b:NERDTreeType”) && b:NERDTreeType == “primary”) | q | endif



set nocompatible

set number

"set coler 256
set t_Co=256


"set vim theme
colorscheme torte


"顯示游標所在的列

"若要顯示游標所在的「列(row)」，也就是標示出游標所在的水平方向，可以使用以下指令來開啟：

set cursorline
set ruler




set ignorecase
set hlsearch

set incsearch

"使用以下指令可以開啟vim的「cindent」自動縮排功能：
set cindent



"vim的TAB和空格處理
"
"使用以下指令可以開啟vim的TAB擴展功能：
"
set expandtab
"將TAB擴展功能開啟之後，在vim插入的「TAB」字元就可以被擴展成一個或是多個空格(space)。如果要插入原本的「TAB」字元，可以先按下Ctrl
"+ v，再按下Tab鍵。





"如果覺得預設標示列的方式只是用底線，感覺很醜而且又會擋到真正的底線字元的話，可以使用「highlight」或是「hi」指令來調整，如下：
"
hi CursorLine cterm=none ctermbg=DarkMagenta ctermfg=White
"以上指令中，「cterm」用來調整文字上的變化：「none」表示維持不變；「underline」表示增加底線；「bold」可以將文字加粗；「reverse」會將顏色反白。






"使用以下指令可以開啟vim的確認功能：
"
set confirm



set history=500

set laststatus=2
syntax enable







"修改vim的狀態列
"
"vim可以透過「statusline」環境變數，設定其狀態列的文字格式。其中，「%t」代表檔案名稱；「%F」代表檔案路徑；「%y」代表檔案類型；「%=」代表左右分隔；「%c」代表目前游標所在的行號；「%l」代表目前游標所在的列號；「%L」代表總列數；「%p」代表目前瀏覽位置的進度百分比。
"
"在「.vimrc」檔案中添加以下指令配置：
set statusline=[%{expand('%:p')}][%{strlen(&fenc)?&fenc:&enc},\ %{&ff},\ %{strlen(&filetype)?&filetype:'plain'}]%{FileSize()}%{IsBinary()}%=%c,%l/%L\ [%3p%%]

function IsBinary()
	    if (&binary == 0)
		            return ""
			        else
					        return "[Binary]"
						    endif
					    endfunction

					    function FileSize()
						        let bytes = getfsize(expand("%:p"))
							    if bytes <= 0
								            return "[Empty]"
									        endif
										    if bytes < 1024
											            return "[" . bytes . "B]"
												        elseif bytes < 1048576
														        return "[" . (bytes / 1024) . "KB]"
															    else
																            return "[" . (bytes / 1048576) . "MB]"
																	        endif
																	endfunction



set statusline=%#filepath#[%{expand('%:p')}]%#filetype#[%{strlen(&fenc)?&fenc:&enc},\ %{&ff},\ %{strlen(&filetype)?&filetype:'plain'}]%#filesize#%{FileSize()}%{IsBinary()}%=%#position#%c,%l/%L\ [%3p%%]

hi filepath cterm=none ctermbg=238 ctermfg=40
hi filetype cterm=none ctermbg=238 ctermfg=45
hi filesize cterm=none ctermbg=238 ctermfg=225
hi position cterm=none ctermbg=238 ctermfg=228



"開啟/關閉vim的指令暫存提示
"
"使用以下指令可以開啟vim的指令暫存提示：
"
set showcmd



"開啟/關閉vim的模式提示
"
"使用以下指令可以開啟vim的模式提示：
"
set showmode





set wrap




"vim可以透過「fileencodings」環境變數，設定其在開啟文字檔時要優先使用什麼字元編碼方式來開啟。但前提是它在編譯前要先設定好有支援「multi_byte」功能。可以在「.vimrc」檔案中撰寫以下判斷式來判斷vim有無支援「multi_byte」功能：
"
if has("multi_byte")
    
    else
        echoerr "If +multi_byte is not included, you should compile Vim with
        big features."
endif





"我們可以依照自己經常接觸的字元編碼和它們個別涵蓋的字元範圍及嚴謹程度來排列出嘗試解碼的順序，並設定給「fileencodings」環境變數儲存。如下：
"
set fileencodings=utf-8,utf-16,big5,gb2312,gbk,gb18030,euc-jp,euc-kr,latin1


set encoding=utf-8

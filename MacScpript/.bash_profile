   
# added by Anaconda3 4.4.0 installer
# export PATH="/anaconda/bin:$PATH"  # commented out by conda initialize
#maven apache-maven-3.5.4
export PATH="/Users/chufei/Maven/bin:$PATH"
alias code=vscode
vscode(){
	filename=$1
	open -a Visual\ Studio\ Code ./$filename;
}

# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/anaconda/bin/conda' 'shell.bash' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/anaconda/etc/profile.d/conda.sh" ]; then
        . "/anaconda/etc/profile.d/conda.sh"
    else
        export PATH="/anaconda/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<

# added by Anaconda3 2019.10 installer
# >>> conda init >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$(CONDA_REPORT_ERRORS=false '/opt/anaconda3/bin/conda' shell.bash hook 2> /dev/null)"
if [ $? -eq 0 ]; then
    \eval "$__conda_setup"
else
    if [ -f "/opt/anaconda3/etc/profile.d/conda.sh" ]; then
        . "/opt/anaconda3/etc/profile.d/conda.sh"
        CONDA_CHANGEPS1=false conda activate base
    else
        \export PATH="/opt/anaconda3/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda init <<<

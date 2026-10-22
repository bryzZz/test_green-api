## Shell commands

The user runs with `blockReadsOutsideWorkingDirectories`: any Bash command whose file access the parser can't resolve statically goes to the user for approval. Keep commands statically analyzable so they run unattended:

- Write literal paths (`git -C /home/.../frontend log`, `ls frontend`): one plain command per call, or a simple `&&` chain.
- Read and edit files with the Read and Edit tools; search with a plain `grep -rn '<pattern>' <literal path>`.
- Shell variables, `$(...)`, loops, and `sed`/`awk` scripts are what trigger the prompt.
